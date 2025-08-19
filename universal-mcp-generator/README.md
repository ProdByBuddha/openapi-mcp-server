# Universal OpenAPI to MCP Tool Generator

[![npm version](https://img.shields.io/npm/v/universal-openapi-mcp-generator.svg)](https://www.npmjs.com/package/universal-openapi-mcp-generator)
[![npm downloads](https://img.shields.io/npm/dm/universal-openapi-mcp-generator.svg)](https://www.npmjs.com/package/universal-openapi-mcp-generator)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/universal-openapi-mcp-generator.svg)](https://nodejs.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/OWNER/REPO/ci.yml?branch=main)](https://github.com/prodbybuddha/universal-openapi-mcp-generator/actions)
This module provides a universal way to generate Model Context Protocol (MCP) tool definitions directly from an OpenAPI (Swagger) specification.

It aims to simplify the process of exposing REST APIs as MCP tools, enabling AI agents to interact with various services through a standardized protocol.

## Features

- Parses OpenAPI 3.x specifications (JSON/YAML).
- Generates MCP tool definitions including `name`, `description`, `inputSchema`, and a dynamic `handler` function.
- Automatically maps OpenAPI paths, methods, parameters (path, query, header, cookie), and request bodies to MCP `inputSchema`.
- Supports basic OpenAPI security schemes (API Key, HTTP Bearer) by integrating with provided `securityHandlers`.
- Resolves API base URLs from the OpenAPI `servers` object.
- Makes HTTP requests using Node.js built-in modules (`http`, `https`) for minimal external dependencies.

## Installation

To use this module in your project, navigate to your project's root and run:

```bash
npm install universal-openapi-mcp-generator
```

(Note: This assumes the module is published to npm. For local development, you would link or copy it.)

## Usage

### `generateMcpTools(openApiSpec, options)`

Generates an array of MCP tool definitions from an OpenAPI specification.

- `openApiSpec`: (Required) The OpenAPI specification. Can be a file path (string) or a parsed JavaScript object.
- `options`: (Optional) An object with configuration options:
  - `baseUrl`: (Optional) The base URL for the API. If not provided, the generator will attempt to use the first URL from the `servers` object in the OpenAPI spec.
  - `securityHandlers`: (Optional) An object mapping security scheme names (as defined in `components.securitySchemes` in your OpenAPI spec) to functions that apply authentication. Each function should take `(headers, query, args, schemeDef)` and modify `headers` or `query` in place based on the `args` (which contain the credentials provided to the MCP tool).

#### Example `securityHandlers`:

```javascript
const securityHandlers = {
  ApiKeyAuth: (headers, query, args, schemeDef) => {
    // schemeDef.name will be the name of the header/query param (e.g., 'X-API-Key')
    if (args.apiKey) {
      headers[schemeDef.name] = args.apiKey; // For API Key in header
    }
  },
  BearerAuth: (headers, query, args, schemeDef) => {
    if (args.bearerToken) {
      headers.Authorization = `Bearer ${args.bearerToken}`;
    }
  },
  // Add more handlers for other security schemes (e.g., OAuth2, Basic Auth)
};
```

### Example Usage:

```javascript
const { generateMcpTools } = require('universal-openapi-mcp-generator');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const openApiSpecPath = path.resolve(__dirname, './path/to/your/openapi.json');
    const openApiSpec = JSON.parse(fs.readFileSync(openApiSpecPath, 'utf8'));

    const securityHandlers = {
      // ... define your security handlers as shown above ...
    };

    const mcpTools = await generateMcpTools(openApiSpec, { securityHandlers });

    console.log('Generated MCP Tools:');
    for (const tool of mcpTools) {
      console.log(`  Name: ${tool.name}`);
      console.log(`  Description: ${tool.description}`);
      console.log(`  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
      console.log('---\n');
    }

    // To call a generated tool:
    // const someTool = mcpTools.find(t => t.name === 'yourToolName');
    // if (someTool) {
    //   const result = await someTool.handler({ /* arguments based on inputSchema */ });
    //   console.log('Tool call result:', result);
    // }

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

## CLI

Install locally and use the CLI to generate MCP tools from an OpenAPI file:

```bash
npx universal-mcp-generator --spec ./path/to/openapi.json --pretty --out tools.json
```

Options:
- `--spec <path>`: OpenAPI 3.x JSON file
- `--baseUrl <url>`: Override base URL (otherwise uses first server in spec)
- `--out <path>`: Write output JSON (otherwise prints to stdout)
- `--pretty`: Pretty-print JSON
- `--security-template`: Print a starter `securityHandlers` template based on spec schemes

## Development

### Tests & Coverage

```bash
npm test
npm run test:coverage
```

### Lint & Format

```bash
npm run lint
npm run format
```

### Injecting HTTP in Tests

`generateMcpTools` accepts `httpRequest` to inject a mock requester, avoiding real network calls:

```js
const tools = await generateMcpTools(spec, { httpRequest: jest.fn(async () => ({ statusCode: 200, body: '{}' })) })
```

## Release Checklist

1) Preflight
- `npm ci`
- `npm run lint`
- `npm test && npm run test:coverage`
- Verify CLI works: `node cli.js --help`

2) Version and changelog
- Update `CHANGELOG.md` with notable changes.
- Bump version: `npm version patch | minor | major` (creates a git tag).

3) Push and publish
- `git push && git push --tags`
- `npm publish --access public`

4) Release notes and badges
- Create a GitHub release from the tag; paste changelog section.
- Replace `OWNER/REPO` in the CI badge above with your repository path.
- Confirm badges render correctly on README.

## Contributing

Contributions are welcome! Please refer to the project's main repository for contribution guidelines.

## License

MIT License
