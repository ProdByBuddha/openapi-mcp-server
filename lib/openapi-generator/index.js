const https = require('https');
const http = require('http');
const { URL } = require('url');
const DEBUG_HTTP = /^(1|true|yes)$/i.test(String(process.env.DEBUG_HTTP || ''));

let SwaggerParser = null;
try { SwaggerParser = require('swagger-parser'); } catch (_) { SwaggerParser = null; }

function buildHeaders(extra) {
  const headers = Object.assign(
    { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    extra || {}
  );
  if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  // Only set Authorization if it's not already set by a security handler
  if (!headers['Authorization']) {
    if (process.env.N8N_BEARER_TOKEN) headers['Authorization'] = `Bearer ${process.env.N8N_BEARER_TOKEN}`;
    if (process.env.N8N_BASIC_AUTH_USER && process.env.N8N_BASIC_AUTH_PASS) {
      const token = Buffer.from(`${process.env.N8N_BASIC_AUTH_USER}:${process.env.N8N_BASIC_AUTH_PASS}`).toString('base64');
      headers['Authorization'] = headers['Authorization'] || `Basic ${token}`;
    }
  }
  return headers;
}

function makeHttpRequest(method, urlString, { headers, body, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const lib = url.protocol === 'https:' ? https : http;
      const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const dbgHeaders = (() => {
        if (!DEBUG_HTTP) return null;
        const h = Object.assign({}, headers);
        if (h && h.Authorization) h.Authorization = '<redacted>';
        if (h && h['X-N8N-API-KEY']) h['X-N8N-API-KEY'] = '<redacted>';
        return h;
      })();
      if (DEBUG_HTTP) console.log('[HTTP OUT]', method, url.toString(), dbgHeaders || {});
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
            if (DEBUG_HTTP) console.log('[HTTP IN ]', method, url.toString(), { status: res.statusCode });
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
  const { baseUrl: explicitBaseUrl, securityHandlers = {}, httpRequest, filters = {} } = options;
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
        const opIdRaw = operation.operationId || operation['x-eov-operation-id'] || null;
        if (!opIdRaw) continue;
        // Filtering rules (include/exclude by tags, operationId, path, summary/description regex)
        const toSet = (arr) => (Array.isArray(arr) ? new Set(arr.map((s) => String(s).toLowerCase())) : null);
        const incTags = toSet(filters.includeTags);
        const excTags = toSet(filters.excludeTags);
        const incOps = toSet(filters.includeOps);
        const excOps = toSet(filters.excludeOps);
        const incPaths = toSet(filters.includePaths);
        const excPaths = toSet(filters.excludePaths);
        const toRegexArr = (arr) => (Array.isArray(arr) ? arr.map((s) => { try { return new RegExp(String(s), 'i'); } catch (_) { return null; } }).filter(Boolean) : null);
        const incTagsRe = toRegexArr(filters.includeTagsRe);
        const excTagsRe = toRegexArr(filters.excludeTagsRe);
        const incOpsRe = toRegexArr(filters.includeOpsRe);
        const excOpsRe = toRegexArr(filters.excludeOpsRe);
        const incPathsRe = toRegexArr(filters.includePathsRe);
        const excPathsRe = toRegexArr(filters.excludePathsRe);
        const matchesRegex = (re, text) => { if (!re) return true; try { return new RegExp(re, 'i').test(text || ''); } catch (_) { return true; } };
        const anyReMatch = (res, text) => { if (!res) return true; const t = String(text || ''); return res.some((r) => r.test(t)); };
        const hasOverlap = (set, arr) => { if (!set) return true; const a = Array.isArray(arr)?arr:[]; return a.some(t => set.has(String(t).toLowerCase())); };
        const opId = String(opIdRaw || '');
        const opIdLc = opId.toLowerCase();
        const tags = (operation.tags || []).map((t) => String(t));
        const tagsLc = tags.map((t) => t.toLowerCase());
        const pathLc = String(path).toLowerCase();
        // include checks (set and regex are additive within each dimension)
        const hasIncTags = !!(incTags || incTagsRe);
        const hasIncOps = !!(incOps || incOpsRe);
        const hasIncPaths = !!(incPaths || incPathsRe);
        const includeText = filters.includeText;
        if (hasIncTags) {
          const ok = (incTags && hasOverlap(incTags, tags)) || (incTagsRe && anyReMatch(incTagsRe, tags.join(' ')));
          if (!ok) continue;
        }
        if (hasIncOps) {
          const ok = (incOps && incOps.has(opIdLc)) || (incOpsRe && anyReMatch(incOpsRe, opId));
          if (!ok) continue;
        }
        if (hasIncPaths) {
          const ok = (incPaths && incPaths.has(pathLc)) || (incPathsRe && anyReMatch(incPathsRe, path));
          if (!ok) continue;
        }
        if (includeText && !matchesRegex(includeText, (operation.summary || operation.description || ''))) continue;
        // exclude checks
        if (excTags && hasOverlap(excTags, tags)) continue;
        if (excTagsRe && anyReMatch(excTagsRe, tags.join(' '))) continue;
        if (excOps && excOps.has(opIdLc)) continue;
        if (excOpsRe && anyReMatch(excOpsRe, opId)) continue;
        if (excPaths && excPaths.has(pathLc)) continue;
        if (excPathsRe && anyReMatch(excPathsRe, path)) continue;
        if (filters.excludeText && matchesRegex(filters.excludeText, (operation.summary || operation.description || ''))) continue;
        const toolName = String(opIdRaw).replace(/\./g, '_');
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
            if (schemeDef) {
              applicableSecuritySchemes.push({ name: schemeName, def: schemeDef });
              if (schemeDef.type === 'apiKey' && !inputSchema.properties[schemeDef.name]) {
                inputSchema.properties[schemeDef.name] = { type: 'string', description: `API Key for ${schemeName}` };
                if(schemeDef.required) inputSchema.required.push(schemeDef.name);
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'bearer' && !inputSchema.properties.bearerToken) {
                inputSchema.properties.bearerToken = { type: 'string', description: `Bearer token for ${schemeName}` };
                inputSchema.required.push('bearerToken');
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'basic' && !inputSchema.properties.username) {
                inputSchema.properties.username = { type: 'string', description: `Username for ${schemeName}` };
                inputSchema.properties.password = { type: 'string', description: `Password for ${schemeName}` };
                inputSchema.required.push('username', 'password');
              } else if (schemeDef.type === 'oauth2' && schemeDef.flows && schemeDef.flows.clientCredentials && !inputSchema.properties.clientId) {
                inputSchema.properties.clientId = { type: 'string', description: 'Client ID for OAuth2' };
                inputSchema.properties.clientSecret = { type: 'string', description: 'Client Secret for OAuth2' };
                inputSchema.required.push('clientId', 'clientSecret');
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
          // Apply custom security handler override if provided
          const customHandlers = securityHandlers || {};
          // Apply security requirements
          for (const secScheme of applicableSecuritySchemes) {
            try {
              const def = secScheme.def || {};
              if (customHandlers && typeof customHandlers[secScheme.name] === 'function') {
                await customHandlers[secScheme.name]({ def, headers: requestHeaders, query: requestQuery, args });
              } else if (def.type === 'apiKey') {
                const keyName = def.name;
                if (def.in === 'header') {
                  requestHeaders[keyName] = args[keyName];
                } else if (def.in === 'query') {
                  requestQuery[keyName] = args[keyName];
                } else if (def.in === 'cookie') {
                  if (keyName && args[keyName] !== undefined) requestCookies[keyName] = args[keyName];
                }
              } else if (def.type === 'http') {
                if (def.scheme === 'bearer') {
                  if (!args.bearerToken) throw new Error('missing bearerToken');
                  requestHeaders['Authorization'] = `Bearer ${args.bearerToken}`;
                } else if (def.scheme === 'basic') {
                  if (!args.username || !args.password) throw new Error('missing username/password');
                  const token = Buffer.from(`${args.username}:${args.password}`).toString('base64');
                  requestHeaders['Authorization'] = `Basic ${token}`;
                }
              } else if (def.type === 'oauth2' && def.flows && def.flows.clientCredentials) {
                const tokenUrl = def.flows.clientCredentials.tokenUrl;
                if (!tokenUrl) throw new Error('missing tokenUrl');
                const tokenRes = await requester('POST', tokenUrl, {
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: `grant_type=client_credentials&client_id=${args.clientId}&client_secret=${args.clientSecret}`
                });
                if (tokenRes.statusCode >= 400) {
                  throw new Error(`token error ${tokenRes.statusCode}`);
                }
                const token = JSON.parse(tokenRes.body || '{}');
                if (!token.access_token) throw new Error('no access_token');
                requestHeaders['Authorization'] = `Bearer ${token.access_token}`;
              }
            } catch (e) {
              throw new Error(`Authentication failed for ${secScheme.name}: ${e.message}`);
            }
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
            let parsed;
            try { parsed = JSON.parse(response.body); msg += ` - ${JSON.stringify(parsed)}`; } catch (_) { parsed = response.body; msg += ` - ${response.body}`; }
            const err = new Error(msg);
            err.response = { statusCode: response.statusCode, statusMessage: response.statusMessage, headers: response.headers, body: parsed };
            throw err;
          }
          try { return JSON.parse(response.body); } catch (_) { return response.body; }
        };
        tools.push({
          name: toolName,
          description,
          inputSchema,
          method: String(method || '').toUpperCase(),
          pathTemplate: path,
          handler,
          serializationInfo: {
            path,
            method,
            pathParams,
            queryParams,
            headerParams,
            cookieParams,
            security: applicableSecuritySchemes.map(s => {
              const base = {
                name: s.name,
                type: s.def.type,
                in: s.def.in,
                scheme: s.def.scheme
              };
              if (s.def.type === 'apiKey') {
                base.paramName = s.def.name; // actual header/query/cookie name
              }
              // Preserve OAuth2 client credentials flow details (e.g., tokenUrl)
              if (s.def.type === 'oauth2' && s.def.flows && s.def.flows.clientCredentials) {
                base.flows = {
                  clientCredentials: {
                    tokenUrl: s.def.flows.clientCredentials.tokenUrl
                  }
                };
              }
              return base;
            }),
            inputSchema
          }
        });
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
