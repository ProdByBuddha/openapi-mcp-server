const SwaggerParser = require('swagger-parser');

// Mock SwaggerParser.dereference to prevent actual file/network access during tests
jest.mock('swagger-parser', () => ({
  dereference: jest.fn(async (spec) => {
    // Return the spec itself, assuming it's already dereferenced for testing purposes
    return spec;
  }),
}));

// Mock the makeHttpRequest function from the module
jest.mock('../index', () => {
  const actualModule = jest.requireActual('../index');
  return {
    ...actualModule,
    makeHttpRequest: jest.fn(async (method, url, options) => {
      // Default mock implementation for successful API calls
      return { statusCode: 200, body: JSON.stringify({ success: true, method, url, options }) };
    }),
  };
});

const { generateMcpTools } = require('../index');

describe('generateMcpTools', () => {
  // Get the mocked makeHttpRequest
  const { makeHttpRequest } = require('../index');

  beforeEach(() => {
    // Reset the mock before each test
    makeHttpRequest.mockClear();
    // Set a default mock implementation for successful API calls
    // This is redundant with the jest.mock above, but good for clarity if specific tests override
    makeHttpRequest.mockImplementation(async (method, url, options) => {
      return { statusCode: 200, body: JSON.stringify({ success: true, method, url, options }) };
    });
    // Clear SwaggerParser mock calls
    SwaggerParser.dereference.mockClear();
    // Set default implementation for SwaggerParser.dereference
    SwaggerParser.dereference.mockImplementation(async (spec) => spec);
  });

  test('should generate MCP tools from a simple OpenAPI spec', async () => {
    const simpleOpenApiSpec = {
      "openapi": "3.0.0",
      "info": {
        "title": "Test API",
        "version": "1.0.0"
      },
      "servers": [
        { "url": "http://test.com/api" }
      ],
      "paths": {
        "/users": {
          "get": {
            "operationId": "listUsers",
            "summary": "List all users",
            "responses": { "200": { "description": "A list of users" } }
          },
          "post": {
            "operationId": "createUser",
            "summary": "Create a new user",
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": { "type": "object", "properties": { "name": { "type": "string" } } }
                }
              }
            },
            "responses": { "201": { "description": "User created" } }
          }
        }
      }
    };

    const tools = await generateMcpTools(simpleOpenApiSpec);

    expect(tools).toHaveLength(2);

    const listUsersTool = tools.find(t => t.name === 'listUsers');
    expect(listUsersTool).toBeDefined();
    expect(listUsersTool.description).toBe('List all users');
    expect(listUsersTool.inputSchema).toEqual({ type: 'object', properties: {}, required: [] });

    const createUserTool = tools.find(t => t.name === 'createUser');
    expect(createUserTool).toBeDefined();
    expect(createUserTool.description).toBe('Create a new user');
    expect(createUserTool.inputSchema.properties.body).toBeDefined();
    expect(createUserTool.inputSchema.properties.body.properties.name).toEqual({ type: 'string' });
    expect(createUserTool.inputSchema.required).toContain('body');
  });

  test('should correctly map advanced schema properties', async () => {
    const advancedSchemaSpec = {
      "openapi": "3.0.0",
      "info": {
        "title": "Advanced Schema Test API",
        "version": "1.0.0"
      },
      "servers": [
        { "url": "http://advanced.api" }
      ],
      "paths": {
        "/items": {
          "get": {
            "operationId": "getItems",
            "summary": "Get items with advanced filters",
            "parameters": [
              {
                "name": "count",
                "in": "query",
                "schema": { "type": "integer", "minimum": 1, "maximum": 10, "exclusiveMinimum": 0 }
              },
              {
                "name": "namePattern",
                "in": "query",
                "schema": { "type": "string", "pattern": "^[A-Z][a-z]*$", "minLength": 2, "maxLength": 20 }
              },
              {
                "name": "ids",
                "in": "query",
                "schema": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 3, "uniqueItems": true }
              }
            ],
            "responses": { "200": { "description": "Items list" } }
          }
        }
      }
    };

    const tools = await generateMcpTools(advancedSchemaSpec);
    expect(tools).toHaveLength(1);

    const getItemsTool = tools.find(t => t.name === 'getItems');
    expect(getItemsTool).toBeDefined();

    const inputSchema = getItemsTool.inputSchema;
    expect(inputSchema.properties.count).toEqual({
      type: 'integer',
      minimum: 1,
      maximum: 10,
      exclusiveMinimum: 0
    });
    expect(inputSchema.properties.namePattern).toEqual({
      type: 'string',
      pattern: '^[A-Z][a-z]*$',
      minLength: 2,
      maxLength: 20
    });
    expect(inputSchema.properties.ids).toEqual({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 3,
      uniqueItems: true
    });
  });

  test('should handle API Key security schemes (header, query, cookie)', async () => {
    const securitySpec = {
      "openapi": "3.0.0",
      "info": {
        "title": "Security Test API",
        "version": "1.0.0"
      },
      "servers": [
        { "url": "http://secure.api" }
      ],
      "components": {
        "securitySchemes": {
          "ApiKeyHeader": { "type": "apiKey", "in": "header", "name": "X-API-Key-Header" },
          "ApiKeyQuery": { "type": "apiKey", "in": "query", "name": "api_key_query" },
          "ApiKeyCookie": { "type": "apiKey", "in": "cookie", "name": "api_key_cookie" }
        }
      },
      "paths": {
        "/data": {
          "get": {
            "operationId": "getData",
            "summary": "Get data with API keys",
            "security": [
              { "ApiKeyHeader": [] },
              { "ApiKeyQuery": [] },
              { "ApiKeyCookie": [] }
            ],
            "responses": { "200": { "description": "Data" } }
          }
        }
      }
    };

    const securityHandlers = {
      ApiKeyHeader: (headers, query, args, schemeDef) => { headers[schemeDef.name] = args[schemeDef.name]; },
      ApiKeyQuery: (headers, query, args, schemeDef) => { query[schemeDef.name] = args[schemeDef.name]; },
      ApiKeyCookie: (headers, query, args, schemeDef) => { /* Handled by handler directly */ }
    };

    const tools = await generateMcpTools(securitySpec, { securityHandlers, httpRequest: makeHttpRequest });
    expect(tools).toHaveLength(1);

    const getDataTool = tools.find(t => t.name === 'getData');
    expect(getDataTool).toBeDefined();

    const inputSchema = getDataTool.inputSchema;
    expect(inputSchema.properties['X-API-Key-Header']).toEqual({ type: 'string', description: 'API Key for ApiKeyHeader' });
    expect(inputSchema.properties.api_key_query).toEqual({ type: 'string', description: 'API Key for ApiKeyQuery' });
    expect(inputSchema.properties.api_key_cookie).toEqual({ type: 'string', description: 'API Key for ApiKeyCookie' });
    expect(inputSchema.required).toEqual(['X-API-Key-Header', 'api_key_query', 'api_key_cookie']);

    await getDataTool.handler({
      'X-API-Key-Header': 'header-val',
      'api_key_query': 'query-val',
      'api_key_cookie': 'cookie-val'
    });

    expect(makeHttpRequest).toHaveBeenCalledTimes(1);
    const callArgs = makeHttpRequest.mock.calls[0];
    expect(callArgs[0]).toBe('GET'); // method
    expect(callArgs[1]).toContain('api_key_query=query-val'); // url should contain query param
    expect(callArgs[2].headers['X-API-Key-Header']).toBe('header-val'); // header should be set
    expect(callArgs[2].headers.Cookie).toContain('api_key_cookie=cookie-val'); // cookie header should be set
  });

  test('should handle HTTP Basic and Bearer security schemes', async () => {
    const httpSecuritySpec = {
      "openapi": "3.0.0",
      "info": {
        "title": "HTTP Security Test API",
        "version": "1.0.0"
      },
      "servers": [
        { "url": "http://http-secure.api" }
      ],
      "components": {
        "securitySchemes": {
          "BasicAuth": { "type": "http", "scheme": "basic" },
          "BearerAuth": { "type": "http", "scheme": "bearer" }
        }
      },
      "paths": {
        "/basic": {
          "get": {
            "operationId": "getBasic",
            "summary": "Get with Basic Auth",
            "security": [{ "BasicAuth": [] }],
            "responses": { "200": { "description": "Basic data" } }
          }
        },
        "/bearer": {
          "get": {
            "operationId": "getBearer",
            "summary": "Get with Bearer Auth",
            "security": [{ "BearerAuth": [] }],
            "responses": { "200": { "description": "Bearer data" } }
          }
        }
      }
    };

    const securityHandlers = {
      BasicAuth: (headers, query, args, schemeDef) => {
        if (args.username && args.password) {
          const token = Buffer.from(`${args.username}:${args.password}`).toString('base64');
          headers.Authorization = `Basic ${token}`;
        }
      },
      BearerAuth: (headers, query, args, schemeDef) => {
        if (args.bearerToken) {
          headers.Authorization = `Bearer ${args.bearerToken}`;
        }
      }
    };

    const tools = await generateMcpTools(httpSecuritySpec, { securityHandlers, httpRequest: makeHttpRequest });
    expect(tools).toHaveLength(2);

    const getBasicTool = tools.find(t => t.name === 'getBasic');
    expect(getBasicTool).toBeDefined();
    expect(getBasicTool.inputSchema.properties.username).toEqual({ type: 'string', description: 'Username for BasicAuth' });
    expect(getBasicTool.inputSchema.properties.password).toEqual({ type: 'string', description: 'Password for BasicAuth' });
    expect(getBasicTool.inputSchema.required).toEqual(['username', 'password']);

    const getBearerTool = tools.find(t => t.name === 'getBearer');
    expect(getBearerTool).toBeDefined();
    expect(getBearerTool.inputSchema.properties.bearerToken).toEqual({ type: 'string', description: 'Bearer token for BearerAuth' });
    expect(getBearerTool.inputSchema.required).toEqual(['bearerToken']);

    // Test Basic Auth handler
    await getBasicTool.handler({ username: 'user', password: 'pass' });
    expect(makeHttpRequest).toHaveBeenCalledTimes(1);
    let callArgs = makeHttpRequest.mock.calls[0];
    expect(callArgs[2].headers.Authorization).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);

    // Test Bearer Auth handler
    await getBearerTool.handler({ bearerToken: 'my-token' });
    expect(makeHttpRequest).toHaveBeenCalledTimes(2); // Called twice now
    callArgs = makeHttpRequest.mock.calls[1];
    expect(callArgs[2].headers.Authorization).toBe(`Bearer my-token`);
  });

  test('should handle missing required path parameters in handler', async () => {
    const spec = {
      "openapi": "3.0.0",
      "info": { "title": "Test", "version": "1.0.0" },
      "servers": [{ "url": "http://test.com" }],
      "paths": {
        "/items/{id}": {
          "get": {
            "operationId": "getItemById",
            "parameters": [
              { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
            ],
            "responses": { "200": { "description": "Item" } }
          }
        }
      }
    };

    const tools = await generateMcpTools(spec, { httpRequest: makeHttpRequest });
    const getItemByIdTool = tools.find(t => t.name === 'getItemById');

    await expect(getItemByIdTool.handler({})).rejects.toThrow('Missing required path parameter: id for tool getItemById');
  });

  test('should handle API call errors', async () => {
    const spec = {
      "openapi": "3.0.0",
      "info": { "title": "Test", "version": "1.0.0" },
      "servers": [{ "url": "http://error.api" }],
      "paths": {
        "/fail": {
          "get": {
            "operationId": "getFail",
            "responses": { "400": { "description": "Bad Request" } }
          }
        }
      }
    };

    const tools = await generateMcpTools(spec, { httpRequest: makeHttpRequest });
    const getFailTool = tools.find(t => t.name === 'getFail');

    // Override makeHttpRequest for this specific test
    makeHttpRequest.mockImplementationOnce(async () => {
      return { statusCode: 400, statusMessage: 'Bad Request', body: JSON.stringify({ error: 'Invalid input' }) };
    });

    await expect(getFailTool.handler({})).rejects.toThrow('API Error: 400 Bad Request - {"error":"Invalid input"}');
  });

  test('should handle non-JSON API responses', async () => {
    const spec = {
      "openapi": "3.0.0",
      "info": { "title": "Test", "version": "1.0.0" },
      "servers": [{ "url": "http://nonjson.api" }],
      "paths": {
        "/text": {
          "get": {
            "operationId": "getText",
            "responses": { "200": { "description": "Plain text" } }
          }
        }
      }
    };

    const tools = await generateMcpTools(spec, { httpRequest: makeHttpRequest });
    const getTextTool = tools.find(t => t.name === 'getText');

    // Override makeHttpRequest for this specific test
    makeHttpRequest.mockImplementationOnce(async () => {
      return { statusCode: 200, body: 'This is plain text' };
    });

    const result = await getTextTool.handler({});
    expect(result).toBe('This is plain text');
  });
});
