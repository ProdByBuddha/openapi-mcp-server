# agents.md

## Project Overview
This project, the OpenAPI MCP Server, transforms any OpenAPI 3.x specification into a set of callable tools for AI agents. It acts as a bridge, allowing agents to interact with various services like n8n, Hostinger, and Docker, or any other service that has an OpenAPI definition. The server is designed to be highly configurable and can be run in different modes to suit various use cases.

- **Purpose and capabilities**: To provide a generic server that can generate and expose tools from OpenAPI specifications, enabling AI agents to control cloud infrastructure and other services.
- **Key features and integrations**:
    - Dynamic tool generation from OpenAPI specs (URL or file).
    - Pre-generation of tools for faster startup.
    - First-class integrations for n8n, Hostinger, and Docker.
    - Multi-service host mode to serve tools from multiple OpenAPI specs in a single process.
    - Security features like rate limiting and allowlists for methods and paths.
- **Target use cases**:
    - Automating cloud infrastructure management.
    - Integrating AI agents with existing APIs.
    - Building complex workflows that span multiple services.

## Agent Interface
The server communicates with agents over `stdio` using a JSON-RPC-like protocol. An agent can interact with the server by sending and receiving JSON messages.

### Protocol
The protocol consists of three main methods:
- `initialize`: Sent by the agent to the server to establish a connection and exchange capabilities. The server responds with its protocol version and server information.
- `tools/list`: Sent by the agent to request a list of available tools. The server responds with a list of tool definitions, including their names, descriptions, and input schemas.
- `tools/call`: Sent by the agent to execute a specific tool. The agent provides the tool name and a JSON object with the arguments. The server executes the tool and returns the result.

### Usage Patterns and Examples
1. **List available tools**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "request-1",
     "method": "tools/list",
     "params": {}
   }
   ```

2. **Call a tool**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "request-2",
     "method": "tools/call",
     "params": {
       "name": "n8n.workflows_getAll",
       "arguments": {
         "limit": 10
       }
     }
   }
   ```

## Project Structure
The project is organized into the following directories:

- `lib/`: Contains the core logic of the project.
  - `lib/openapi-generator/`: The core tool generation logic resides here.
- `examples/`: Contains example server implementations and scripts.
  - `examples/mcp-n8n-server.js`: Example server for n8n.
  - `examples/mcp-hostinger-server.js`: Example server for Hostinger.
  - `examples/mcp-docker-server.js`: Example server for Docker.
  - `examples/mcp-openapi-server.js`: Generic server for any OpenAPI spec.
  - `examples/mcp-multi-host.js`: Server for hosting multiple services.
  - `examples/generate-openapi-mcp-tools.js`: Script to pre-generate tools.
- `specs/`: Contains OpenAPI specification files for various services.
- `tests/`: Contains the test suite for the project.

### Key Files
- `package.json`: Defines project metadata, dependencies, and scripts.
- `README.md`: Provides a human-readable overview of the project.
- `.env.example`: Example environment file for configuration.

### Entry Points and Scripts
The `package.json` file contains several scripts for running the server and performing other tasks:
- `npm run mcp:n8n`: Starts the n8n MCP server.
- `npm run mcp:hostinger`: Starts the Hostinger MCP server.
- `npm run mcp:openapi`: Starts the generic OpenAPI MCP server.
- `npm run mcp:gen`: Generates tools from an OpenAPI spec.
- `npm test`: Runs the test suite.

## Integration Capabilities
The server supports integration with any service that has an OpenAPI 3.x specification. It also has first-class support for the following services:

### n8n
- **Authentication**: `N8N_API_URL` and `N8N_API_KEY` environment variables.
- **Configuration**: See the "Hardening" section in `README.md` for options like `N8N_MCP_ALLOWED_METHODS` and `N8N_MCP_ALLOWED_PATHS`.

### Hostinger
- **Authentication**: `HOSTINGER_API_TOKEN` environment variable.
- **Configuration**: See the "Hostinger Server" section in `README.md` for options like `HOSTINGER_API_URL` and `HOSTINGER_SPEC_FILE`.

### Docker
- **Configuration**: The Docker server wraps the Docker CLI and Engine API. See the "Docker Server" section in `README.md` for environment variables like `DOCKER_ALLOW_RUN`.

### Generic OpenAPI
- **Configuration**: Use the `OPENAPI_SPEC_FILE` or `OPENAPI_SPEC_URL` environment variables to specify the OpenAPI spec. Authentication can be configured using environment variables like `OPENAPI_API_KEY`, `OPENAPI_BEARER_TOKEN`, etc.

### Multi-Service Host
The server can be configured to serve tools from multiple services at once using a JSON configuration file. See `examples/mcp-multi-host.js` and `examples/services.example.json` for more details.

## Development Workflow
### Setup
1. Clone the repository: `git clone https://github.com/ProdByBuddha/openapi-mcp-server.git`
2. Install dependencies: `npm install`
3. Create a `.env` file from `.env.example` and configure the necessary environment variables.

### Testing
- Run the full test suite: `npm test`
- The tests include end-to-end tests for the different server implementations and auto-generated unit tests for the OpenAPI tools.

### Contribution Guidelines
Please refer to `CONTRIBUTING.md` for guidelines on how to contribute to this project.
