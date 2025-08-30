# AGENTS.md

## Project Overview
The OpenAPI MCP Server (@prodbybuddha/openapi-mcp-server) is a universal bridge that transforms any OpenAPI 3.x specification into callable MCP (Model Context Protocol) tools for AI agents. It enables seamless integration between AI agents and REST APIs, cloud infrastructure, and backend services.

- **Purpose and capabilities**: Generic server that dynamically generates and exposes MCP tools from OpenAPI specifications, enabling AI agents to control cloud infrastructure, automate workflows, and integrate with any REST API.
- **Key features and integrations**:
    - Dynamic tool generation from OpenAPI specs (URL or file) with real-time loading
    - Multi-service host mode serving tools from multiple APIs in a single process
    - First-class integrations for n8n, Hostinger, Docker, Adobe PDF Services, and 15+ popular services
    - SOAP/WSDL support (experimental) for legacy systems
    - Multiple transport modes: stdio (primary), HTTP, WebSocket, SSE
    - Built-in authentication handling (API keys, Bearer tokens, OAuth2, Basic auth)
    - Security hardening with rate limiting, method/path allowlists, and audit logging
    - Full server generation with TypeScript support
    - Auto-discovery from documentation pages (Swagger UI, Redoc, Stoplight)
    - ES modules architecture for modern Node.js compatibility
- **Target use cases**:
    - Automating cloud infrastructure management across multiple providers
    - Building AI-powered workflow automation spanning multiple services
    - Integrating AI agents with business APIs and legacy systems
    - Creating unified interfaces for heterogeneous API ecosystems
    - Document processing and PDF manipulation workflows

## Agent Interface
The server supports multiple transport modes for agent communication, with stdio being the primary MCP-compliant interface using JSON-RPC 2.0 protocol.

### Transport Modes
- **stdio** (primary): Standard MCP transport for AI agents and IDEs
- **HTTP**: REST API endpoints for testing and integration (`/mcp` endpoint)
- **WebSocket**: Real-time bidirectional communication (`/mcp` path)
- **SSE**: Server-sent events for streaming responses (`/mcp-sse` endpoint)

### MCP Protocol Methods
The server implements the standard MCP protocol with these core methods:
- `initialize`: Establishes connection and exchanges capabilities (protocol version, server info)
- `tools/list`: Returns available tool definitions with names, descriptions, and input schemas
- `tools/call`: Executes a specific tool with provided arguments and returns results

### Tool Naming Convention
Tools are namespaced by service to avoid collisions: `<service>.<toolName>`
- Example: `n8n.workflows_getAll`, `hostinger.domains_getDomainListV1`, `docker.ps`

### Usage Patterns and Examples
1. **Initialize connection**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "init-1",
     "method": "initialize",
     "params": {
       "protocolVersion": "2024-11-05",
       "clientInfo": { "name": "agent", "version": "1.0.0" }
     }
   }
   ```

2. **List available tools**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "list-1",
     "method": "tools/list",
     "params": {}
   }
   ```

3. **Call a namespaced tool**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "call-1",
     "method": "tools/call",
     "params": {
       "name": "n8n.workflows_getAll",
       "arguments": { "limit": 10, "active": true }
     }
   }
   ```

4. **One-time tool execution** (CLI mode):
   ```bash
   node examples/mcp-multi-host.js --once tools/call '{"name":"hostinger.domains_getDomainListV1","arguments":{}}'
   ```

## Project Structure
The project follows a modular architecture with clear separation between core logic, examples, and generated content:

### Core Directories
- **`lib/openapi-generator/`**: Core tool generation engine (ES modules)
  - `index.js`: Main generator functions and HTTP utilities
  - `server-generator.js`: Full MCP server scaffolding generator
  - `templates/`: JavaScript server templates (.js, package.json, README, etc.)
  - `templates-ts/`: TypeScript server templates (.ts, tsconfig.json, etc.)

- **`examples/`**: Executable MCP servers and CLI utilities (ES modules)
  - `mcp-multi-host.js`: **Primary entry point** - multi-service host server
  - `mcp-n8n-server.js`: Dedicated n8n integration server
  - `mcp-hostinger-server.js`: Dedicated Hostinger integration server
  - `mcp-docker-server.js`: Docker CLI and Engine API wrapper
  - `mcp-openapi-server.js`: Generic OpenAPI server (converted to ES modules)
  - `generate-openapi-mcp-tools.js`: CLI tool generator
  - `n8n-workflows-cli.js`: n8n workflow management CLI
  - `scripts/`: Automation utilities (spec discovery, validation, merging, config templates)
    - `create-config-templates.js`: Generate configuration templates and validation scripts
    - `generate-config-schemas.js`: Extract and generate configuration schemas
    - `generate-config-templates.js`: Generate configuration templates for common use cases
  - `generated/`: Auto-generated tool definitions and documentation
  - `config-templates/`: Generated configuration templates for common use cases

- **`specs/`**: OpenAPI specification files
  - Local specs for n8n, Hostinger, Adobe PDF Services, sample APIs
  - `adobe-pdf-services.yaml`: Comprehensive PDF processing operations (combine, OCR, protect, extract, document generation)
  - Used as input for tool generation and testing

- **`tests/`**: Comprehensive test suite
  - `run-all.js`: Main test runner with E2E and unit tests
  - `e2e.*.test.js`: End-to-end integration tests
  - `unit/`: Unit tests for specific components and generated tools
  - `tmp/`: Temporary test artifacts and generated servers

- **`generated-*`**: Complete generated MCP server examples
  - Full project scaffolds with package.json, HTTP clients, tool handlers
  - Demonstrate the output of the server generation feature

### Configuration Files
- **Service Configurations**:
  - `services.default.json`: Minimal example configuration
  - `services.dynamic.json`: Production configuration with 15+ popular services
  - `services.example.json`: Template with all configuration options
- **Configuration Templates**: `examples/config-templates/`
  - Individual service templates (`n8n.json`, `hostinger.json`, `docker.json`)
  - Multi-service template (`multi-service.json`)
  - Validation scripts (`validate-config.js`)
  - Migration guides (`MIGRATION.md`)
- **Environment**: `.env.example`, `.env` (local)
- **MCP Client**: `mcp.config.json` (sample Cursor/Kiro configuration)
- **Package**: `package.json` with 40+ npm scripts for all operations

### Key Entry Points and Scripts
**Primary Operations**:
- `npm run mcp:n8n`: n8n MCP server
- `npm run mcp:hostinger`: Hostinger MCP server  
- `npm run mcp:openapi`: Generic OpenAPI MCP server
- `node examples/mcp-multi-host.js --config services.json`: Multi-service host

**Tool Generation**:
- `npm run mcp:gen`: Generate tools from OpenAPI spec
- `npm run mcp:gen:server`: Generate complete MCP server project
- `npm run mcp:tools:readme`: Build tools documentation

**Configuration Management**:
- `node examples/scripts/create-config-templates.js`: Generate configuration templates
- `node examples/scripts/generate-config-schemas.js`: Generate configuration schemas
- `node examples/scripts/generate-config-templates.js`: Generate configuration templates

**Testing & Validation**:
- `npm test`: Full test suite (E2E + unit tests)
- `npm run openapi:spec-gate:all`: Conformance + fuzz testing
- `npm run openapi:lint:all`: Validate all OpenAPI specs

**Service Management**:
- `npm run services:regen`: Regenerate service configs from specs
- `npm run services:merge`: Merge service configurations
- `npm run discover:spec`: Auto-discover OpenAPI specs from docs pages

## Integration Capabilities
The server provides universal OpenAPI 3.x integration plus first-class support for popular services and experimental SOAP/WSDL support.

### Universal OpenAPI Integration
**Any REST API** with OpenAPI 3.x specification:
- **Dynamic Loading**: `OPENAPI_SPEC_URL` or `OPENAPI_SPEC_FILE` with support for JSON and YAML formats
- **Robust Parsing**: Enhanced YAML/JSON parsing with proper ES module imports, automatic path parameter extraction with fallback mechanisms for incomplete specs
- **Authentication**: Supports all OpenAPI security schemes
  - API Key: `OPENAPI_API_KEY` or scheme-specific `OPENAPI_APIKEY_<SCHEME>`
  - Bearer Token: `OPENAPI_BEARER_TOKEN`
  - Basic Auth: `OPENAPI_BASIC_USER` and `OPENAPI_BASIC_PASS`
  - OAuth2: Client credentials flow with automatic token management
- **Base URL Override**: `OPENAPI_BASE_URL`
- **Security Controls**: Method/path allowlists, rate limiting, audit logging

### First-Class Service Integrations

#### n8n Workflow Automation
- **Authentication**: `N8N_API_URL`, `N8N_API_KEY` (or `N8N_BEARER_TOKEN`, Basic auth)
- **Features**: Workflow management, execution monitoring, credential handling
- **Hardening**: `N8N_MCP_ALLOWED_METHODS`, `N8N_MCP_ALLOWED_PATHS`, rate limiting
- **CLI Tools**: Workflow export/import, activation, bulk operations

#### Hostinger Cloud Hosting
- **Authentication**: `HOSTINGER_API_TOKEN`
- **Features**: Domain management, VPS control, DNS configuration, billing
- **SDK Integration**: Optional use of official `hostinger-api-sdk` for enhanced experience
- **Profiles**: Curated tools vs. raw OpenAPI tools (`HOSTINGER_PROFILE=curated`)

#### Docker Container Management
- **Features**: Container lifecycle, image management, Docker Compose, Engine API
- **Safety Gates**: `DOCKER_ALLOW_RUN=1`, `DOCKER_ALLOWED_IMAGES` allowlist
- **Backends**: Docker CLI + Docker Engine API via socket or HTTP
- **Debug**: `DEBUG_DOCKER=1` for command/API logging

#### Adobe PDF Services
- **Authentication**: `ADOBE_ACCESS_TOKEN` (Bearer token) and `x-api-key` header
- **Features**: Comprehensive PDF processing operations
  - **Asset Management**: Create upload placeholders, manage PDF assets
  - **Document Operations**: Combine multiple PDFs, OCR processing, password protection
  - **Content Extraction**: Extract text, images, and structure from PDFs
  - **Document Generation**: Generate PDFs from templates and JSON data
- **API Coverage**: Assets, operations (combine, OCR, protect, extract, document generation), job status tracking
- **Configuration**: Available in `services.dynamic.json` as `adobe_pdf` service

### Multi-Service Host Architecture
**Single Process, Multiple APIs**: Configure unlimited services in one MCP server
- **Configuration**: JSON files with service definitions (`services.*.json`)
- **Namespacing**: Tools prefixed with service name (`service.toolName`)
- **Environment Expansion**: `${VAR}` placeholders in URLs and file paths
- **Auth Per Service**: Individual authentication schemes per service
- **Filtering**: Include/exclude operations by tags, paths, or regex patterns

#### Pre-configured Service Ecosystem (services.dynamic.json)
**15+ Popular Services Ready-to-Use**:
- **Development**: GitHub, Slack, Notion, Docker
- **Business**: Stripe, SendGrid, Airtable, Wix
- **Infrastructure**: n8n, Hostinger
- **Document Processing**: Adobe PDF Services (combine, OCR, protect, extract, document generation), Proof.com signatures
- **Shipping/Mail**: USPS, Lob, Unipile
- **Government**: IRS MEF (tax filing)

### SOAP/WSDL Support (Experimental)
**Legacy System Integration**:
- **Configuration**: `"type": "soap"`, `wsdlUrl`, optional `endpoint`
- **Features**: Automatic operation discovery, SOAP envelope handling
- **Use Cases**: Government systems (IRS MEF), enterprise legacy APIs
- **Tool Format**: `{ "body": {...}, "headers": {...} }` arguments

### Auto-Discovery Features
**Documentation → Spec URL**:
- **Supported Formats**: Swagger UI, Redoc, Stoplight Elements
- **Discovery**: Extracts OpenAPI URLs from HTML/JS documentation pages
- **CLI**: `npm run discover:spec -- --url https://docs.example.com`
- **Integration**: Works with multi-host configuration for dynamic service addition

## Development Workflow

### Environment Setup
1. **Clone and Install**:
   ```bash
   git clone https://github.com/ProdByBuddha/openapi-mcp-server.git
   cd openapi-mcp-server
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Configure service credentials (N8N_API_KEY, HOSTINGER_API_TOKEN, etc.)
   ```

3. **Node.js Requirements**:
   - **Node.js >=14.0.0** required for ES modules support
   - Project uses `"type": "module"` for native ES modules
   - All entry points use ES module syntax (`import`/`export`)

4. **Recommended Environment Loading**:
   ```bash
   # Install dotenvx for advanced env management
   npm install -g @dotenvx/dotenvx
   # Run with enhanced env loading
   dotenvx run -- node examples/mcp-multi-host.js --config services.dynamic.json
   ```

### Development Commands

#### Quick Start Testing
```bash
# Test individual services
N8N_API_KEY=xxx npm run mcp:n8n:once -- tools/list {}
HOSTINGER_API_TOKEN=xxx npm run mcp:hostinger:once -- tools/list {}

# Multi-service host
node examples/mcp-multi-host.js --config services.default.json --once tools/list {}
```

#### Tool Generation Workflow
```bash
# Generate tools from any OpenAPI spec
npm run mcp:gen -- --from-url https://api.example.com/openapi.json --out tools.json

# Generate complete MCP server project (ES modules by default)
OPENAPI_BASE_URL=https://api.example.com npm run mcp:gen:server -- \
  --from-file spec.json --generate-server ./my-server --ts true

# Auto-discover specs from documentation
npm run discover:spec -- --url https://docs.example.com/api
```

#### Service Configuration Management
```bash
# Generate configuration templates for common use cases
node examples/scripts/create-config-templates.js --validate --migration

# Generate configuration schemas from codebase
node examples/scripts/generate-config-schemas.js --out schemas/config-schema.json

# Regenerate service configs from all specs
npm run services:regen

# Merge configurations with conflict reporting
npm run services:report

# Validate service configuration
npm run services:lint:config

# Validate specific service environment
node examples/config-templates/validate-config.js n8n

# Validate configuration file
node examples/config-templates/validate-config.js services.json
```

### Testing Strategy

#### Comprehensive Test Suite
```bash
# Full test suite (E2E + unit + generated)
npm test

# Specific test categories
npm run openapi:spec-gate:all      # Conformance + fuzz testing
npm run openapi:lint:all           # OpenAPI spec validation
```

#### Spec Gate Validation
**Conformance + Fuzz Testing** for OpenAPI specs:
```bash
# Test all specs with randomized inputs
npm run openapi:spec-gate:all

# Test specific service with custom runs
npm run openapi:spec-gate:hostinger
node examples/scripts/spec-gate.js --file spec.json --runs 5 --include-tags Domains
```

#### Generated Server Testing
- **Auto-generated unit tests**: Every OpenAPI tool gets a dry-run unit test
- **E2E integration tests**: Real API calls with configured credentials
- **Generated server validation**: Full project scaffolds are tested for compilation and runtime

### Quality Assurance

#### Code Quality
- **ES Modules**: All code uses modern ES module syntax (`import`/`export`) with proper module import handling for better tree-shaking and static analysis
- **YAML/JSON Parsing**: Robust file format detection with proper ES module imports for YAML processing
- **Linting**: OpenAPI spec validation with swagger-parser
- **Security**: Built-in hardening controls and audit logging
- **Performance**: Rate limiting and resource management
- **Reliability**: Comprehensive error handling and fallback mechanisms

#### CI/CD Integration
- **GitHub Actions**: Automated testing and tool regeneration
- **On-premise CI**: n8n workflow integration (see `docs/ONPREM-CI.md`)
- **Spec Gate Badge**: Public conformance status indicator

### Contribution Guidelines
- **Code Standards**: Follow existing patterns in `examples/` and `lib/`, use ES module syntax (`import`/`export`)
- **ES Modules**: All new code must use ES modules - no CommonJS (`require`/`module.exports`)
- **Testing**: Add tests for new features, ensure spec-gate passes
- **Documentation**: Update relevant `.md` files and inline comments
- **Security**: Follow security best practices, no hardcoded credentials
- **Compatibility**: Maintain Node.js >=14.0.0 compatibility for ES modules support

For detailed contribution guidelines, see `CONTRIBUTING.md`.

## Current Version & Recent Improvements

**Version 1.6.4+** - Latest stable release with comprehensive configuration management and recent stability fixes:

### Major Features Added
- **ES Modules Architecture**: Full conversion to ES modules (`"type": "module"`) for modern Node.js compatibility
- **Enhanced Environment Loading**: Upgraded to `@dotenvx/dotenvx` with fallback to basic `dotenv` for improved environment variable management and Vault integration
- **Multi-Transport Architecture**: Full support for stdio, HTTP, WebSocket, and SSE transports
- **SOAP/WSDL Integration**: Experimental support for legacy SOAP services
- **TypeScript Server Generation**: Complete TypeScript project scaffolding with type safety
- **Auto-Discovery System**: Extract OpenAPI specs from documentation pages automatically
- **Comprehensive Service Ecosystem**: 15+ pre-configured popular services in `services.dynamic.json`
- **Adobe PDF Services Integration**: Full support for PDF processing operations (combine, OCR, protect, extract, document generation)
- **Robust Path Parameter Handling**: Automatic extraction of path parameters from URL templates with fallback mechanisms for incomplete OpenAPI specs

### Developer Experience Improvements
- **ES Modules Migration**: Complete conversion from CommonJS to ES modules with proper module import handling for modern Node.js compatibility and better performance
- **Enhanced File Processing**: Improved YAML/JSON parsing with correct ES module imports ensuring reliable specification file processing
- **Configuration Management System**: Complete configuration template generator with validation scripts and migration guides
- **Spec Gate Validation**: Conformance + fuzz testing for OpenAPI specs
- **GitHub Wiki Integration**: Auto-generated documentation with CI/CD pipeline
- **Enhanced CLI Tools**: One-shot execution mode, service configuration management, template generation
- **Improved Error Handling**: Better error messages and fallback mechanisms
- **Security Hardening**: Enhanced rate limiting, audit logging, and access controls
- **OpenAPI Spec Compatibility**: Enhanced parsing with automatic path parameter detection for better compatibility with various OpenAPI specification formats
- **Recent Stability Fixes**: Fixed syntax error in WebSocket transport initialization ensuring proper Express app setup and improved error handling in multi-transport scenarios

### Architecture Evolution
- **Modern ES Modules**: Full conversion to ES modules with proper module import handling for better tree-shaking, static analysis, and future compatibility
- **Robust File Processing**: Enhanced YAML/JSON parsing with proper ES module imports ensuring reliable spec file processing
- **Primary Entry Point**: `examples/mcp-multi-host.js` as the main server
- **Modular Design**: Clear separation between core generator and service implementations
- **Extensible Plugin System**: Easy addition of new service integrations
- **Production Ready**: Comprehensive testing, CI/CD, and monitoring capabilities

The project has evolved from a simple n8n integration to a comprehensive OpenAPI-to-MCP bridge supporting enterprise-grade deployments with multiple services, security controls, and extensive customization options. The recent conversion to ES modules with proper import handling ensures compatibility with modern Node.js ecosystems and improved performance.
