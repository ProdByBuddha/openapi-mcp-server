const https = require('https');
const http = require('http');
const { URL } = require('url');

let SwaggerParser = null;
try { SwaggerParser = require('swagger-parser'); } catch (_) { SwaggerParser = null; }

function buildHeaders(extra) {
  const headers = Object.assign(
    { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    extra || {}
  );
  if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  if (process.env.N8N_BEARER_TOKEN) headers['Authorization'] = `Bearer ${process.env.N8N_BEARER_TOKEN}`;
  if (process.env.N8N_BASIC_AUTH_USER && process.env.N8N_BASIC_AUTH_PASS) {
    const token = Buffer.from(`${process.env.N8N_BASIC_AUTH_USER}:${process.env.N8N_BASIC_AUTH_PASS}`).toString('base64');
    headers['Authorization'] = headers['Authorization'] || `Basic ${token}`;
  }
  return headers;
}

function makeHttpRequest(method, urlString, { headers, body, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const lib = url.protocol === 'https:' ? https : http;
      const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const req = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: buildHeaders(Object.assign({}, headers, data ? { 'Content-Length': String(data.length) } : {}))
        },
        (res) => {
          let resBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (resBody += chunk));
          res.on('end', () => {
            const result = {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              body: resBody
            };
            resolve(result);
          });
        }
      );
      req.on('error', reject);
      if (timeoutMs) req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out')));
      if (data) req.write(data);
      req.end();
    } catch (err) { reject(err); }
  });
}

function makeUrl(baseUrlString, pathname, query) {
  const base = new URL(baseUrlString);
  const joinedPath = (base.pathname.replace(/\/$/, '') + '/' + String(pathname || '').replace(/^\//, '')) || '/';
  const dest = new URL(base.origin);
  dest.pathname = joinedPath;
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      dest.searchParams.set(k, String(v));
    }
  }
  return dest.toString();
}

function mapOpenApiSchemaToJsonSchema(schema) {
  const jsonSchema = {};
  if (!schema || typeof schema !== 'object') return { type: 'object' };
  if (schema.type) jsonSchema.type = schema.type;
  if (schema.format) jsonSchema.format = schema.format;
  if (schema.description) jsonSchema.description = schema.description;
  if (schema.enum) jsonSchema.enum = schema.enum;
  if (schema.default) jsonSchema.default = schema.default;
  if (schema.example) jsonSchema.example = schema.example;
  if (schema.pattern) jsonSchema.pattern = schema.pattern;
  if (schema.minLength !== undefined) jsonSchema.minLength = schema.minLength;
  if (schema.maxLength !== undefined) jsonSchema.maxLength = schema.maxLength;
  if (schema.minimum !== undefined) jsonSchema.minimum = schema.minimum;
  if (schema.maximum !== undefined) jsonSchema.maximum = schema.maximum;
  if (schema.exclusiveMinimum !== undefined) jsonSchema.exclusiveMinimum = schema.exclusiveMinimum;
  if (schema.exclusiveMaximum !== undefined) jsonSchema.exclusiveMaximum = schema.exclusiveMaximum;
  if (schema.minItems !== undefined) jsonSchema.minItems = schema.minItems;
  if (schema.maxItems !== undefined) jsonSchema.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) jsonSchema.uniqueItems = schema.uniqueItems;
  if (schema.properties) {
    jsonSchema.properties = {};
    for (const propName in schema.properties) {
      jsonSchema.properties[propName] = mapOpenApiSchemaToJsonSchema(schema.properties[propName]);
    }
  }
  if (schema.items) jsonSchema.items = mapOpenApiSchemaToJsonSchema(schema.items);
  if (schema.required) jsonSchema.required = schema.required;
  if (schema.allOf) jsonSchema.allOf = schema.allOf.map(mapOpenApiSchemaToJsonSchema);
  if (schema.anyOf) jsonSchema.anyOf = schema.anyOf.map(mapOpenApiSchemaToJsonSchema);
  if (schema.oneOf) jsonSchema.oneOf = schema.oneOf.map(mapOpenApiSchemaToJsonSchema);
  return jsonSchema;
}

async function generateMcpTools(openApiSpec, options = {}) {
  const { baseUrl: explicitBaseUrl, securityHandlers = {}, httpRequest } = options;
  const requester = httpRequest || makeHttpRequest;
  const tools = [];
  try {
    let api = openApiSpec;
    if (SwaggerParser && (typeof openApiSpec === 'string' || typeof openApiSpec === 'object')) {
      api = await SwaggerParser.dereference(openApiSpec);
    }
    if (!api || !api.paths) throw new Error('Invalid OpenAPI spec: missing paths');
    let resolvedBaseUrl = explicitBaseUrl;
    if (!resolvedBaseUrl && api.servers && api.servers.length > 0) {
      resolvedBaseUrl = api.servers[0].url;
    }
    if (!resolvedBaseUrl) throw new Error('Base URL not provided and no servers defined in OpenAPI spec.');

    for (const path in api.paths) {
      for (const method in api.paths[path]) {
        const operation = api.paths[path][method];
        if (!operation || typeof operation !== 'object') continue;
        if (!['get','post','put','patch','delete','head','options'].includes(method)) continue;
        if (!operation.operationId) continue;
        const toolName = operation.operationId.replace(/\./g, '_');
        const description = operation.summary || operation.description || `Calls ${method.toUpperCase()} ${path}`;
        const inputSchema = { type: 'object', properties: {}, required: [] };
        const pathParams = [];
        const queryParams = [];
        const headerParams = [];
        const cookieParams = [];
        if (operation.parameters) {
          for (const param of operation.parameters) {
            const prop = mapOpenApiSchemaToJsonSchema((param && param.schema) || { type: 'string' });
            if (param && param.description) prop.description = param.description;
            if (param && param.required) inputSchema.required.push(param.name);
            switch (param && param.in) {
              case 'path': pathParams.push(param.name); inputSchema.properties[param.name] = prop; break;
              case 'query': queryParams.push(param.name); inputSchema.properties[param.name] = prop; break;
              case 'header': headerParams.push(param.name); inputSchema.properties[param.name] = prop; break;
              case 'cookie': cookieParams.push(param.name); inputSchema.properties[param.name] = prop; break;
            }
          }
        }
        if (operation.requestBody && operation.requestBody.content) {
          const content = operation.requestBody.content['application/json'] ||
            operation.requestBody.content['application/x-www-form-urlencoded'] ||
            Object.values(operation.requestBody.content)[0];
          if (content && content.schema) {
            const bodySchema = mapOpenApiSchemaToJsonSchema(content.schema);
            inputSchema.properties.body = bodySchema;
            if (operation.requestBody.required) inputSchema.required.push('body');
          }
        }
        const securityRequirements = operation.security || api.security || [];
        const applicableSecuritySchemes = [];
        for (const securityRequirement of securityRequirements) {
          for (const schemeName in securityRequirement) {
            const schemeDef = api.components && api.components.securitySchemes && api.components.securitySchemes[schemeName];
            if (schemeDef && securityHandlers[schemeName]) {
              applicableSecuritySchemes.push({ name: schemeName, def: schemeDef, handler: securityHandlers[schemeName] });
              if (schemeDef.type === 'apiKey' && !inputSchema.properties[schemeDef.name]) {
                inputSchema.properties[schemeDef.name] = { type: 'string', description: `API Key for ${schemeName}` };
                inputSchema.required.push(schemeDef.name);
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'bearer' && !inputSchema.properties.bearerToken) {
                inputSchema.properties.bearerToken = { type: 'string', description: `Bearer token for ${schemeName}` };
                inputSchema.required.push('bearerToken');
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'basic' && !inputSchema.properties.username) {
                inputSchema.properties.username = { type: 'string', description: `Username for ${schemeName}` };
                inputSchema.properties.password = { type: 'string', description: `Password for ${schemeName}` };
                inputSchema.required.push('username', 'password');
              }
            }
          }
        }
        const handler = async (args = {}) => {
          let resolvedPath = path;
          const requestQuery = {};
          const requestHeaders = {};
          const requestCookies = {};
          let requestBody;
          for (const secScheme of applicableSecuritySchemes) {
            try {
              secScheme.handler(requestHeaders, requestQuery, args, secScheme.def);
              if (secScheme.def && secScheme.def.type === 'apiKey' && secScheme.def.in === 'cookie') {
                const cookieName = secScheme.def.name;
                if (cookieName && args[cookieName] !== undefined) requestCookies[cookieName] = args[cookieName];
              }
            } catch (e) { throw new Error(`Authentication failed for ${secScheme.name}: ${e.message}`); }
          }
          for (const paramName of pathParams) {
            if (args[paramName] === undefined) throw new Error(`Missing required path parameter: ${paramName} for tool ${toolName}`);
            resolvedPath = resolvedPath.replace(`{${paramName}}`, encodeURIComponent(String(args[paramName])));
          }
          for (const paramName of queryParams) if (args[paramName] !== undefined) requestQuery[paramName] = args[paramName];
          for (const paramName of headerParams) if (args[paramName] !== undefined) requestHeaders[paramName] = args[paramName];
          for (const paramName of cookieParams) if (args[paramName] !== undefined) requestCookies[paramName] = args[paramName];
          if (Object.keys(requestCookies).length > 0) requestHeaders['Cookie'] = Object.entries(requestCookies).map(([k, v]) => `${k}=${v}`).join('; ');
          if (inputSchema.properties.body && args.body !== undefined) requestBody = args.body;
          const url = makeUrl(resolvedBaseUrl, resolvedPath, requestQuery);
          const response = await requester(method.toUpperCase(), url, { headers: requestHeaders, body: requestBody });
          if (response.statusCode >= 400) {
            let msg = `API Error: ${response.statusCode} ${response.statusMessage}`;
            try { msg += ` - ${JSON.stringify(JSON.parse(response.body))}`; } catch (_) { msg += ` - ${response.body}`; }
            throw new Error(msg);
          }
          try { return JSON.parse(response.body); } catch (_) { return response.body; }
        };
        tools.push({ name: toolName, description, inputSchema, method: String(method || '').toUpperCase(), pathTemplate: path, handler });
      }
    }
  } catch (err) { throw err; }
  return tools;
}

module.exports = {
  buildHeaders,
  makeHttpRequest,
  makeUrl,
  generateMcpTools
};

