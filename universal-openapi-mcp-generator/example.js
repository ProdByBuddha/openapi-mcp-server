const { generateMcpTools } = require('./index');
const fs = require('fs');
const path = require('path');

async function runExample() {
  try {
    const n8nOpenApiSpecPath = path.resolve(__dirname, 'n8n-openapi-spec.json');

    // Create a dummy n8n-openapi-spec.json for testing with security schemes and new schema properties
    const dummySpec = {
      "openapi": "3.0.0",
      "info": {
        "title": "Test API with Advanced Schemas",
        "version": "1.0.0"
      },
      "servers": [
        { "url": "http://localhost:5678/api/v1" }
      ],
      "components": {
        "securitySchemes": {
          "ApiKeyAuthHeader": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key-Header"
          },
          "ApiKeyAuthQuery": {
            "type": "apiKey",
            "in": "query",
            "name": "api_key_query"
          },
          "ApiKeyAuthCookie": {
            "type": "apiKey",
            "in": "cookie",
            "name": "api_key_cookie"
          },
          "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
          },
          "BasicAuth": {
            "type": "http",
            "scheme": "basic"
          }
        }
      },
      "paths": {
        "/users": {
          "get": {
            "operationId": "listUsers",
            "summary": "List users with filters",
            "parameters": [
              {
                "name": "minAge",
                "in": "query",
                "required": false,
                "schema": { "type": "integer", "minimum": 18, "exclusiveMaximum": 100 }
              },
              {
                "name": "searchQuery",
                "in": "query",
                "required": false,
                "schema": { "type": "string", "minLength": 3, "maxLength": 50, "pattern": "^[a-zA-Z0-9]*$" }
              },
              {
                "name": "tags",
                "in": "query",
                "required": false,
                "schema": { "type": "array", "items": { "type": "string" }, "maxItems": 5, "uniqueItems": true }
              }
            ],
            "security": [
              { "ApiKeyAuthHeader": [] },
              { "ApiKeyAuthQuery": [] },
              { "ApiKeyAuthCookie": [] }
            ],
            "responses": {
              "200": {
                "description": "Successful response"
              }
            }
          },
          "post": {
            "operationId": "createUser",
            "summary": "Create a new user",
            "security": [
              { "BearerAuth": [] }
            ],
            "requestBody": {
              "required": true,
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string", "minLength": 2 },
                      "email": { "type": "string", "format": "email" },
                      "age": { "type": "integer", "minimum": 0 }
                    },
                    "required": ["name", "email"]
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "Successful response"
              }
            }
          }
        },
        "/login": {
          "post": {
            "operationId": "loginUser",
            "summary": "Login user with basic auth",
            "security": [
              { "BasicAuth": [] }
            ],
            "responses": {
              "200": {
                "description": "Login successful"
              }
            }
          }
        }
      }
    };

    fs.writeFileSync(n8nOpenApiSpecPath, JSON.stringify(dummySpec, null, 2));

    // Define security handlers
    const securityHandlers = {
      ApiKeyAuthHeader: (headers, query, args, schemeDef) => {
        if (args[schemeDef.name]) {
          headers[schemeDef.name] = args[schemeDef.name];
        }
      },
      ApiKeyAuthQuery: (headers, query, args, schemeDef) => {
        if (args[schemeDef.name]) {
          query[schemeDef.name] = args[schemeDef.name];
        }
      },
      ApiKeyAuthCookie: (headers, query, args, schemeDef) => {
        if (args[schemeDef.name]) {
          // For cookie, the handler needs to set the Cookie header
          // This is handled in the main handler function by collecting requestCookies
          // The arg is just passed through
        }
      },
      BearerAuth: (headers, query, args, schemeDef) => {
        if (args.bearerToken) {
          headers.Authorization = `Bearer ${args.bearerToken}`;
        }
      },
      BasicAuth: (headers, query, args, schemeDef) => {
        if (args.username && args.password) {
          const token = Buffer.from(`${args.username}:${args.password}`).toString('base64');
          headers.Authorization = `Basic ${token}`;
        }
      }
    };

    const mcpTools = await generateMcpTools(n8nOpenApiSpecPath, { securityHandlers });

    console.log('Generated MCP Tools:');
    for (const tool of mcpTools) {
      console.log(`  Name: ${tool.name}`);
      console.log(`  Description: ${tool.description}`);
      console.log(`  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
      // console.log('  Handler (function, not printable)');
      console.log('---\n');
    }

    // Example of calling a generated tool (this will attempt a real HTTP request)
    console.log('\nAttempting to call a generated tool (listUsers)...');
    const listUsersTool = mcpTools.find(t => t.name === 'listUsers');
    if (listUsersTool) {
      try {
        // Pass API keys for header, query, and cookie
        const result = await listUsersTool.handler({
          'X-API-Key-Header': 'header-key',
          'api_key_query': 'query-key',
          'api_key_cookie': 'cookie-key',
          minAge: 20,
          searchQuery: 'test',
          tags: ['tag1', 'tag2']
        });
        console.log('listUsers result:', result);
      } catch (handlerError) {
        console.error('Error calling listUsers tool:', handlerError.message);
      }
    } else {
      console.log('listUsers tool not found.');
    }

    console.log('\nAttempting to call a generated tool (createUser) with Bearer token...');
    const createUserTool = mcpTools.find(t => t.name === 'createUser');
    if (createUserTool) {
      try {
        const result = await createUserTool.handler({
          bearerToken: 'your-bearer-token',
          body: { name: 'John Doe', email: 'john.doe@example.com', age: 30 }
        });
        console.log('createUser result:', result);
      } catch (handlerError) {
        console.error('Error calling createUser tool:', handlerError.message);
      }
    } else {
      console.log('createUser tool not found.');
    }

    console.log('\nAttempting to call a generated tool (loginUser) with Basic Auth...');
    const loginUserTool = mcpTools.find(t => t.name === 'loginUser');
    if (loginUserTool) {
      try {
        const result = await loginUserTool.handler({
          username: 'testuser',
          password: 'testpass'
        });
        console.log('loginUser result:', result);
      } catch (handlerError) {
        console.error('Error calling loginUser tool:', handlerError.message);
      }
    } else {
      console.log('loginUser tool not found.');
    }

  } catch (error) {
    console.error('Error in example:', error);
  }
}

runExample();