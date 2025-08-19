const https = require('https');
const http = require('http');
const { URL } = require('url');
const SwaggerParser = require('swagger-parser');

/**
 * Builds HTTP headers, including optional authentication headers from environment variables.
 * This function will be generalized to handle OpenAPI security schemes.
 * @param {object} [extra] - Additional headers to include.
 * @returns {object} The constructed headers object.
 */
function buildHeaders(extra) {
  const headers = Object.assign(
    {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    extra || {}
  );

  // These are n8n-specific, but we'll keep them for now as placeholders or for later generalization
  if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  if (process.env.N8N_BEARER_TOKEN) headers['Authorization'] = `Bearer ${process.env.N8N_BEARER_TOKEN}`;
  if (process.env.N8N_BASIC_AUTH_USER && process.env.N8N_BASIC_AUTH_PASS) {
    const token = Buffer.from(`${process.env.N8N_BASIC_AUTH_USER}:${process.env.N8N_BASIC_AUTH_PASS}`).toString('base64');
    headers['Authorization'] = headers['Authorization'] || `Basic ${token}`;
  }
  return headers;
}

/**
 * Makes an HTTP request.
 * @param {string} method - HTTP method (e.g., 'GET', 'POST').
 * @param {string} urlString - The full URL for the request.
 * @param {object} [options] - Request options.
 * @param {object} [options.headers] - Request headers.
 * @param {any} [options.body] - Request body.
 * @param {number} [options.timeoutMs] - Request timeout in milliseconds.
 * @returns {Promise<object>} A promise that resolves with the response object.
 */
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
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Constructs a URL from a base URL, pathname, and query parameters.
 * @param {string} baseUrlString - The base URL (e.g., 'http://localhost:5678/api/v1').
 * @param {string} pathname - The path to append to the base URL.
 * @param {object} [query] - Query parameters as an object.
 * @returns {string} The constructed URL string.
 */
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

/**
 * Maps an OpenAPI schema object to a JSON Schema property.
 * @param {object} schema - The OpenAPI schema object.
 * @returns {object} The corresponding JSON Schema property.
 */
function mapOpenApiSchemaToJsonSchema(schema) {
  const jsonSchema = {};
  if (schema.type) jsonSchema.type = schema.type;
  if (schema.format) jsonSchema.format = schema.format;
  if (schema.description) jsonSchema.description = schema.description;
  if (schema.enum) jsonSchema.enum = schema.enum;
  if (schema.default) jsonSchema.default = schema.default;
  if (schema.example) jsonSchema.example = schema.example;

  // String properties
  if (schema.pattern) jsonSchema.pattern = schema.pattern;
  if (schema.minLength !== undefined) jsonSchema.minLength = schema.minLength;
  if (schema.maxLength !== undefined) jsonSchema.maxLength = schema.maxLength;

  // Numeric properties
  if (schema.minimum !== undefined) jsonSchema.minimum = schema.minimum;
  if (schema.maximum !== undefined) jsonSchema.maximum = schema.maximum;
  if (schema.exclusiveMinimum !== undefined) jsonSchema.exclusiveMinimum = schema.exclusiveMinimum;
  if (schema.exclusiveMaximum !== undefined) jsonSchema.exclusiveMaximum = schema.exclusiveMaximum;

  // Array properties
  if (schema.minItems !== undefined) jsonSchema.minItems = schema.minItems;
  if (schema.maxItems !== undefined) jsonSchema.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) jsonSchema.uniqueItems = schema.uniqueItems;

  if (schema.properties) {
    jsonSchema.properties = {};
    for (const propName in schema.properties) {
      jsonSchema.properties[propName] = mapOpenApiSchemaToJsonSchema(schema.properties[propName]);
    }
  }
  if (schema.items) {
    jsonSchema.items = mapOpenApiSchemaToJsonSchema(schema.items);
  }
  if (schema.required) {
    jsonSchema.required = schema.required;
  }
  // Handle allOf, anyOf, oneOf - basic support by just including them
  if (schema.allOf) jsonSchema.allOf = schema.allOf.map(mapOpenApiSchemaToJsonSchema);
  if (schema.anyOf) jsonSchema.anyOf = schema.anyOf.map(mapOpenApiSchemaToJsonSchema);
  if (schema.oneOf) jsonSchema.oneOf = schema.oneOf.map(mapOpenApiSchemaToJsonSchema);

  return jsonSchema;
}

/**
 * Generates MCP tool definitions from an OpenAPI specification.
 * @param {string|object} openApiSpec - Path to OpenAPI spec file or the spec object itself.
 * @param {object} [options] - Options for generation.
 * @param {string} [options.baseUrl] - The base URL for the API endpoints. If not provided, attempts to use OpenAPI 'servers' object.
 * @param {object} [options.securityHandlers] - An object mapping security scheme names to functions that apply authentication.
 *                                            Each function should take (headers, query, args) and modify them in place.
 *                                            Example: { apiKeyAuth: (headers, query, args) => { headers['X-API-Key'] = args.apiKey; } }
 * @returns {Promise<Array<object>>} A promise that resolves with an array of MCP tool definitions.
 */
async function generateMcpTools(openApiSpec, options = {}) {
  const { baseUrl: explicitBaseUrl, securityHandlers = {}, httpRequest } = options;
  // Allow tests/consumers to inject a requester to avoid real network calls
  const requester = httpRequest || makeHttpRequest;
  const tools = [];
  try {
    console.log('Parsing OpenAPI specification...');
    const api = await SwaggerParser.dereference(openApiSpec);
    console.log('OpenAPI specification parsed successfully.');

    // Determine base URL from OpenAPI servers if not explicitly provided
    let resolvedBaseUrl = explicitBaseUrl;
    if (!resolvedBaseUrl && api.servers && api.servers.length > 0) {
      resolvedBaseUrl = api.servers[0].url; // Use the first server URL as default
      console.log(`Using base URL from OpenAPI spec: ${resolvedBaseUrl}`);
    }
    if (!resolvedBaseUrl) {
      const errorMsg = 'Base URL not provided and no servers defined in OpenAPI spec.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    for (const path in api.paths) {
      for (const method in api.paths[path]) {
        const operation = api.paths[path][method];
        if (!operation.operationId) {
          console.warn(`Skipping operation at ${method.toUpperCase()} ${path} due to missing operationId.`);
          continue; // operationId is crucial for tool naming
        }

        const toolName = operation.operationId.replace(/\./g, '_'); // Sanitize for tool name
        const description = operation.summary || operation.description || `Calls ${method.toUpperCase()} ${path}`;

        const inputSchema = { type: 'object', properties: {}, required: [] };
        const pathParams = [];
        const queryParams = [];
        const headerParams = [];
        const cookieParams = [];

        if (operation.parameters) {
          for (const param of operation.parameters) {
            // Map OpenAPI parameter schema to JSON Schema property
            const prop = mapOpenApiSchemaToJsonSchema(param.schema || { type: 'string' });
            if (param.description) prop.description = param.description;
            if (param.required) inputSchema.required.push(param.name);

            switch (param.in) {
              case 'path':
                pathParams.push(param.name);
                inputSchema.properties[param.name] = prop;
                break;
              case 'query':
                queryParams.push(param.name);
                inputSchema.properties[param.name] = prop;
                break;
              case 'header':
                headerParams.push(param.name);
                inputSchema.properties[param.name] = prop;
                break;
              case 'cookie':
                cookieParams.push(param.name);
                inputSchema.properties[param.name] = prop;
                break;
            }
          }
        }

        if (operation.requestBody && operation.requestBody.content) {
          // Prioritize application/json, then application/x-www-form-urlencoded, then first available
          const content = operation.requestBody.content['application/json'] ||
            operation.requestBody.content['application/x-www-form-urlencoded'] ||
            Object.values(operation.requestBody.content)[0];

          if (content && content.schema) {
            const bodySchema = mapOpenApiSchemaToJsonSchema(content.schema);
            inputSchema.properties.body = bodySchema;
            if (operation.requestBody.required) {
              inputSchema.required.push('body');
            }
          }
        }

        // Handle security requirements
        const securityRequirements = operation.security || api.security || [];
        const applicableSecuritySchemes = [];

        for (const securityRequirement of securityRequirements) {
          for (const schemeName in securityRequirement) {
            const schemeDef = api.components.securitySchemes[schemeName];
            if (schemeDef && securityHandlers[schemeName]) {
              applicableSecuritySchemes.push({ name: schemeName, def: schemeDef, handler: securityHandlers[schemeName] });
              // Add security parameters to inputSchema if they are not already there
              // This is a simplified approach; a more robust solution might involve specific input properties for credentials
              if (schemeDef.type === 'apiKey' && !inputSchema.properties[schemeDef.name]) {
                // API Key can be in header, query, or cookie
                inputSchema.properties[schemeDef.name] = { type: 'string', description: `API Key for ${schemeName}` };
                inputSchema.required.push(schemeDef.name);
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'bearer' && !inputSchema.properties.bearerToken) {
                inputSchema.properties.bearerToken = { type: 'string', description: `Bearer token for ${schemeName}` };
                inputSchema.required.push('bearerToken');
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'basic' && !inputSchema.properties.username) {
                // For basic auth, add username and password to inputSchema
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
          const requestCookies = {}; // New: for cookie parameters
          let requestBody = undefined;

          // Apply security handlers first to populate headers/query/body with credentials
          for (const secScheme of applicableSecuritySchemes) {
            try {
              secScheme.handler(requestHeaders, requestQuery, args, secScheme.def);
              // If the security scheme is an apiKey in cookie, map arg to Cookie header collection
              if (secScheme.def && secScheme.def.type === 'apiKey' && secScheme.def.in === 'cookie') {
                const cookieName = secScheme.def.name;
                if (cookieName && args[cookieName] !== undefined) {
                  requestCookies[cookieName] = args[cookieName];
                }
              }
            } catch (handlerErr) {
              console.error(`Error in security handler for ${secScheme.name}:`, handlerErr.message);
              throw new Error(`Authentication failed for ${secScheme.name}: ${handlerErr.message}`);
            }
          }

          // Resolve path parameters
          for (const paramName of pathParams) {
            if (args[paramName] === undefined) {
              throw new Error(`Missing required path parameter: ${paramName} for tool ${toolName}`);
            }
            resolvedPath = resolvedPath.replace(`{${paramName}}`, encodeURIComponent(String(args[paramName])));
          }

          // Resolve query parameters
          for (const paramName of queryParams) {
            if (args[paramName] !== undefined) {
              requestQuery[paramName] = args[paramName];
            }
          }

          // Resolve header parameters
          for (const paramName of headerParams) {
            if (args[paramName] !== undefined) {
              requestHeaders[paramName] = args[paramName];
            }
          }

          // Resolve cookie parameters (new)
          for (const paramName of cookieParams) {
            if (args[paramName] !== undefined) {
              requestCookies[paramName] = args[paramName];
            }
          }
          // Add cookie parameters to headers (simplified, might need proper cookie handling for browsers)
          if (Object.keys(requestCookies).length > 0) {
            requestHeaders['Cookie'] = Object.entries(requestCookies).map(([k, v]) => `${k}=${v}`).join('; ');
          }

          // Resolve body
          if (inputSchema.properties.body && args.body !== undefined) {
            requestBody = args.body;
          }

          const url = makeUrl(resolvedBaseUrl, resolvedPath, requestQuery);
          console.log(`Calling API: ${method.toUpperCase()} ${url}`);
          const response = await requester(method.toUpperCase(), url, {
            headers: requestHeaders,
            body: requestBody
          });

          // Basic error handling and response parsing
          if (response.statusCode >= 400) {
            let errorMessage = `API Error: ${response.statusCode} ${response.statusMessage}`;
            try {
              const parsedBody = JSON.parse(response.body);
              errorMessage += ` - ${JSON.stringify(parsedBody)}`;
            } catch (_) {
              errorMessage += ` - ${response.body}`;
            }
            console.error(`API call failed for ${toolName}: ${errorMessage}`);
            throw new Error(errorMessage);
          }
          try {
            console.log(`API call successful for ${toolName}. Status: ${response.statusCode}`);
            return JSON.parse(response.body);
          } catch (e) {
            console.warn(`API response for ${toolName} is not JSON. Returning raw body.`);
            return response.body; // Return raw body if not JSON
          }
        };

        tools.push({
          name: toolName,
          description,
          inputSchema,
          // Include minimal metadata to support offline JSON export
          method: String(method || '').toUpperCase(),
          pathTemplate: path,
          handler,
        });
      }
    }
  } catch (err) {
    console.error('Error generating MCP tools from OpenAPI spec:', err);
    throw err;
  }
  return tools;
}

// Export functions for use in other modules
module.exports = {
  buildHeaders,
  makeHttpRequest,
  makeUrl,
  generateMcpTools
};
