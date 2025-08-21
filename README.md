# OpenAPI MCP Server (@prodbybuddha/openapi-mcp-server)

[![npm version](https://img.shields.io/npm/v/@prodbybuddha/openapi-mcp-server?logo=npm&color=cb0000)](https://www.npmjs.com/package/@prodbybuddha/openapi-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/ProdByBuddha/openapi-mcp-server?sort=semver)](https://github.com/ProdByBuddha/openapi-mcp-server/releases)
[![Spec Gate](https://img.shields.io/endpoint?url=https://your-n8n/webhook/spec-gate-badge)](#spec-gate-conformance--fuzz)

Generic OpenAPI → MCP tool server with first‑class Docker, n8n & Hostinger integrations. It can:
- Load any OpenAPI 3.x spec and generate MCP tools on the fly
- Expose tools over stdio (initialize, tools/list, tools/call)
- Provide built‑in servers with convenience methods and workflow CLI

## ☁️ Control Your Cloud Infrastructure

This server empowers your agents to seamlessly control various backend systems and cloud infrastructure, including:

*   **Docker:** Manage containers, images, and even Docker Compose directly.
*   **Any API:** Connect to and automate any service with an OpenAPI specification.

This means you can build powerful automation that spans your entire digital ecosystem, from frontends to backend services and cloud resources.

No credentials are stored; set env vars when running.

## Documentation

This project provides comprehensive documentation to help you get started and make the most of its features:

*   **[Main README.md](README.md):** You are here! This file provides a quick overview and essential setup instructions.
*   **[For "Vibe Coders"](VIBE.md):** A simplified, non-technical introduction to the project's value and utility.
*   **[GitHub Wiki](https://github.com/ProdByBuddha/openapi-mcp-server/wiki):** The most comprehensive and navigable source of documentation. It's automatically built and kept up-to-date from the project's source Markdown files, offering detailed guides, examples, and how-tos.

## Support

If this project helps you, consider supporting:

[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy%20me%20a%20coffee-ffdd00?logo=buymeacoffee&logoColor=black)](https://donate.stripe.com/9AQbLka97fFx75K8ww)

### Donations

Programmatic-friendly wallet addresses are published in `donate.json` at the repo root as a destination for users, developers, and AI agents to support the cause:

- Worldchain: `0xe4fdf9076dca468d839b51f75af35983b898821b`
- Ethereum / Polygon / BSC / Arbitrum / Optimism / Avalanche: `0x5f596473Dea9043B6338EF33a747CF0426EBcf92`
- Bitcoin: `bc1qctmts3a2kmtfqskp0d5hrrew4gy9nhalu6mc4m`
- Solana: `2yUpjfwiQiv4pme1BSMLPpWgUcuWUMj6Q1KDetrPMc19`
- Cardano: `addr1qyqn6zvqrhmx8h83eady5kk9ytfskrz4dgw6fcj32cxaetxyvpz05tv3rqhgc28qqpq5f9rvkvmpu60j43lfn4crcphs747ush`

Supporters can either read `donate.json` directly or run:

`npm run donate:print`

## Install

- From npm (use inside your project):
  - `npm install @prodbybuddha/openapi-mcp-server`
  - Generic server: `OPENAPI_SPEC_URL='https://api.example.com/openapi.json' node node_modules/@prodbybuddha/openapi-mcp-server/examples/mcp-openapi-server.js`
  - n8n server: `N8N_API_URL='https://your-n8n/api/v1' N8N_API_KEY='<key>' node node_modules/@prodbybuddha/openapi-mcp-server/examples/mcp-n8n-server.js`

- From source (clone/fork):
  - `npm install`
  - Generic server: `OPENAPI_SPEC_URL='https://api.example.com/openapi.json' npm run mcp:openapi`
  - n8n server: `N8N_API_URL='https://your-n8n/api/v1' N8N_API_KEY='<key>' npm run mcp:n8n`

## Generator API

The OpenAPI→MCP tool generator is bundled in this package and exposed via a subpath export.
Use it programmatically or via the example CLI to pre‑generate tools JSON.

- Programmatic: `const { generateMcpTools } = require('@prodbybuddha/openapi-mcp-server/lib/openapi-generator');`
- CLI: `node examples/generate-openapi-mcp-tools.js --from-url <specUrl> --out examples/generated/n8n-openapi-tools.json`

The server can also load OpenAPI specs dynamically on startup via env vars
(`OPENAPI_SPEC_FILE` or `OPENAPI_SPEC_URL`) without pre‑generation.

### Advanced: Custom Security Handlers

If your OpenAPI defines custom security schemes or you want to override default behavior, pass `securityHandlers` to `generateMcpTools`:

```
const tools = await generateMcpTools(spec, {
  baseUrl: 'https://api.example.com/v1',
  securityHandlers: {
    myApiKey: ({ def, headers, args }) => { headers[def.name] = process.env.MY_API_KEY; },
    oauth2scheme: async ({ def, headers }) => { /* fetch token from vault and set headers.Authorization */ }
  }
});
```

Each handler receives `{ def, headers, query, args }`. Set headers/query as needed. Default handlers cover `apiKey`, `http: bearer/basic`, and `oauth2: clientCredentials`.

## Generate Tools (recommended)

- From URL (OpenAPI via Swagger UI):
  - `N8N_API_KEY='<key>' npm run mcp:gen -- --from-url https://your-n8n/api/v1/docs/swagger-ui-init.js`
- From file (if you have a JSON spec):
  - `npm run mcp:gen -- --from-file path/to/openapi.json`
- Build index (pretty list):
  - `npm run mcp:tools:readme` → writes `examples/generated/TOOLS.md`

### Generate a Full MCP Server from OpenAPI

- From file:
  - `OPENAPI_BASE_URL=https://api.example.com/v1 npm run mcp:gen:server -- --from-file path/to/openapi.json --generate-server ./generated-server`
- From URL:
  - `OPENAPI_BASE_URL=https://api.example.com/v1 npm run mcp:gen:server -- --from-url https://api.example.com/openapi.json --generate-server ./generated-server`

- Filters (optional):
  - `--include-tags billing,domains` `--exclude-ops opA,opB` `--include-text "widget|order"`
  - Regex variants: `--include-tags-re tag1,tag2` `--include-ops-re "^get.*"` `--include-paths-re "/v1/.*"` (case-insensitive)

- TypeScript output (optional):
  - Append `--ts true` to generate a TS server with `index.ts`, `tools.ts`, `http-client.ts`, and `tsconfig.json`

The generated project includes a minimal HTTP client and tool handlers with input validation (Zod) and supports stdio transport via the entry index.

### Dynamic OpenAPI tools (no pre-gen step)

The server can load OpenAPI tools at startup via the bundled generator. Set one of:

- `OPENAPI_SPEC_FILE=./path/to/openapi.json npm run mcp:openapi`
- `OPENAPI_SPEC_URL=https://api.example.com/openapi.json npm run mcp:openapi`

Optionally override the base URL used by generated tools:

- `OPENAPI_BASE_URL=https://api.example.com/v1`

If neither env is set, the server will fall back to loading `examples/generated/n8n-openapi-tools.json` when present.

## Generic OpenAPI Server

This repo also includes a generic OpenAPI→MCP server that can expose any OpenAPI 3.x API as MCP tools.

- Run: `OPENAPI_SPEC_FILE=./openapi.json npm run mcp:openapi`
- Or: `OPENAPI_SPEC_URL=https://api.example.com/openapi.json npm run mcp:openapi`
- Optional: `OPENAPI_BASE_URL=https://api.example.com/v1`

## Hostinger Server

This repo includes a first-class Hostinger MCP server that dynamically loads tools from the bundled Hostinger OpenAPI spec (`examples/specs/hostinger-api.json`) or a URL/file.

- Run (stdio): `HOSTINGER_API_TOKEN=... npm run mcp:hostinger`
- One-off call: `HOSTINGER_API_TOKEN=... npm run mcp:hostinger:once -- tools/list {}`

Env:
- `HOSTINGER_API_TOKEN` (required): sets `Authorization: Bearer <token>`
- `HOSTINGER_API_URL` (optional): override base URL; defaults to spec `servers[0].url`
- `HOSTINGER_SPEC_FILE` or `HOSTINGER_SPEC_URL` (optional): provide a custom OpenAPI spec
- `DEBUG_HTTP=1` to log summarized HTTP traffic
- `HOSTINGER_USE_SDK=1` (optional): if the official Node/TypeScript SDK `hostinger-api-sdk` is installed, expose a few curated helpers (catalog list, domains list, availability) that use the SDK under the hood. Falls back to OpenAPI-generated tools when not set or SDK absent.
- `HOSTINGER_PROFILE=curated` (optional): show curated helpers first and, by default, hide raw OpenAPI tools. Combine with:
  - `HOSTINGER_INCLUDE_RAW=1` to include raw tools alongside curated ones.
  - `HOSTINGER_ALLOW_RAW="name1,name2"` to allowlist specific raw tool names when using the curated profile.

Hardening (applies to generated tools):
- `OPENAPI_MCP_ALLOWED_METHODS` (e.g., `GET,POST`)
- `OPENAPI_MCP_ALLOWED_PATHS` (e.g., `/api/*`)
- `OPENAPI_MCP_RATE_LIMIT`, `OPENAPI_MCP_RATE_WINDOW_MS`

### Example Calls

- List catalog items (optional filters: `category`, `name`):
  - `HOSTINGER_API_TOKEN=... node examples/mcp-hostinger-server.js --once billing_getCatalogItemListV1 '{"category":"vps"}'`

- List domains (no args required):
  - `HOSTINGER_API_TOKEN=... node examples/mcp-hostinger-server.js --once domains_getDomainListV1 '{}'`

Tip: Run `npm run mcp:hostinger:once -- tools/list {}` to see all tool names and input schemas. Many tools support optional query parameters; supply them in the JSON object as shown above.

### Complementing Official Hostinger Projects

- Official MCP server: https://github.com/hostinger/api-mcp-server
- Official TypeScript SDK: https://github.com/hostinger/api-typescript-sdk (npm: `hostinger-api-sdk`)

This project focuses on:
- Aggregation and consistency across multiple providers (e.g., Hostinger + n8n + other OpenAPI specs) with one MCP host.
- Dynamic generation from OpenAPI, hardening controls, and transport options.
- Optional use of vendor SDKs when available for a superior developer experience.

Guidance:
- If you only need Hostinger, prefer the official server for first-party support and features.
- Use this project when you want to combine Hostinger with other APIs, enforce shared policies, or generate tools dynamically from specs.

Auth helpers (optional, used to populate security handlers):
- `OPENAPI_API_KEY` or scheme-specific `OPENAPI_APIKEY_<SCHEMENAME>`
- `OPENAPI_BEARER_TOKEN`
- `OPENAPI_BASIC_USER` and `OPENAPI_BASIC_PASS`

Policy controls (optional):
- `OPENAPI_MCP_ALLOWED_METHODS` (e.g., `GET,POST`)
- `OPENAPI_MCP_ALLOWED_PATHS` (e.g., `/v1/users*,/v1/*`)
- `OPENAPI_MCP_RATE_LIMIT` and `OPENAPI_MCP_RATE_WINDOW_MS`
- Logging: `OPENAPI_MCP_LOG_FILE`, `OPENAPI_MCP_LOG_MAX_SIZE`, `OPENAPI_MCP_LOG_MAX_FILES`, `OPENAPI_MCP_LOG_FORMAT`

### HTTP Debug Logging

For both the generic server and generated servers, you can enable verbose HTTP logs when troubleshooting:

- `DEBUG_HTTP=1` — Prints outbound request headers and summarized responses. Also logs OAuth2 token exchanges (without secrets) during client credentials flow.

See also: `examples/README.md` for script quickstarts.

### Lint OpenAPI

- `npm run openapi:lint` (defaults to `examples/specs/hostinger-api.json`)
- `npm run openapi:lint:all` — recursively lints all specs under `specs/`
- Or: `npm run openapi:lint:file -- ./path/to/openapi.json`

Validates structure (via swagger-parser if installed), checks duplicate/missing operationIds, presence of paths/servers.

### HTML Test Client (HTTP)

- Open `examples/http-html-client.html` in a browser.
- Run a generated server in HTTP mode and set endpoint to `/mcp`.
- Use it to send `tools/list` or `tools/call` payloads interactively.

Example:

`DEBUG_HTTP=1 OPENAPI_SPEC_FILE=./openapi.json npm run mcp:openapi`

## Configuration

Set environment variables directly or via `.env` (see `.env.example`):
- `N8N_API_URL`: Base API URL ending with `/api/v1`
- `N8N_API_KEY`: API key sent as `X-N8N-API-KEY`
- Optional: `N8N_BEARER_TOKEN`, `N8N_BASIC_AUTH_USER/PASS`

## Tests

- End-to-end: `N8N_API_URL=... N8N_API_KEY=... npm test`
  - Generates tools, calls the MCP server over stdio, and asserts workflows can be listed.
- Auto-generated unit tests: The test runner creates a dry-run unit test for every OpenAPI tool and executes it (no network).

## Spec Gate (Conformance + Fuzz)

Validate specs structurally and then fuzz each operation with randomized, no-network dry runs. Catches missing params, bad path templates, enum/constraints issues early and reinforces the “no errors if the host spec is good” promise.

- Run all local specs:
  - `npm run openapi:spec-gate:all`
- Single file:
  - `node examples/scripts/spec-gate.js --file examples/specs/hostinger-api.json --runs 3`
- Tag filters:
  - `node examples/scripts/spec-gate.js --file examples/specs/hostinger-api.json --runs 3 --include-tags Domains`
- Operation/path filters:
  - `--include-ops domains_getDomainListV1,domains_getDomainDetailsV1`
  - `--include-paths-re "/v1/domains/.*"`
- Optional field probability:
  - `SPEC_GATE_OPT_PROB=0.6 node examples/scripts/spec-gate.js --file ... --runs 3`

Convenience scripts:
- `npm run openapi:spec-gate:hostinger`
- `npm run openapi:spec-gate:domains`
- `npm run openapi:spec-gate:dns`
- `npm run openapi:spec-gate:vps`

## CI (optional)

The repo includes sample GitHub Actions workflows (in `.github/workflows/`):
- `CI`: installs deps and runs tests. E2E runs only if repo secrets are configured.
- `Update Generated MCP Tools`: regenerates OpenAPI tools on a schedule or manual dispatch.

For on‑prem CI with n8n workers, see `docs/ONPREM-CI.md`.

Tip: In your fork, set `N8N_API_URL` and `N8N_API_KEY` repository secrets to enable E2E in CI and auto‑update the generated tools.

## CLI (Workflows)

- List: `npm run n8n:list`
- Export: `npm run n8n:export -- --id <id> --out backups/workflows/<name>.json`
- Update: `npm run n8n:update -- --id <id> --file backups/workflows/<name>.json`

## Hardening

Environment variables to restrict behavior:
- `N8N_MCP_ALLOWED_METHODS=GET,POST` — Allowed HTTP methods
- `N8N_MCP_ALLOWED_PATHS=/workflows*,/executions*` — Allowed path patterns
- `N8N_MCP_RATE_LIMIT=120 N8N_MCP_RATE_WINDOW_MS=60000` — Basic rate limiting
- Logging (optional): `N8N_MCP_LOG_FILE=./logs/mcp-n8n.log`

## Security & Distribution

- MIT License
- No secrets stored; env-only credentials
- `.npmignore` excludes local data and generated files

## Credits

Created by Billy Coleman III.

## Authorship & License

- License: MIT. See `LICENSE` and `NOTICE` for attribution guidance.
- Authorship: Original work by Billy Coleman III; evolved by community contributions.

## Auto-Update MCP Tools (CI)

This repo includes a workflow that regenerates the MCP tool registry from your n8n API’s OpenAPI spec and commits changes automatically.
- Triggers: manual dispatch or scheduled (daily at 03:00 UTC)
- What it does: fetches the spec from `${N8N_API_URL}/docs/swagger-ui-init.js`, regenerates `examples/generated/n8n-openapi-tools.json` and `examples/generated/TOOLS.md`, validates load.

## Hardening Options

You can restrict and rate-limit what the MCP server can call against your n8n API using environment variables:

- `N8N_MCP_DISABLE_GENERIC`:
  - Disables the generic `n8n.request` tool entirely when set to `1`/`true`.
  - Only generated/allowlisted tools remain available.
- `N8N_MCP_ALLOWED_METHODS`:
  - Comma-separated HTTP methods allowed (default: `GET,POST,PUT,PATCH,DELETE`).
  - Example: `N8N_MCP_ALLOWED_METHODS=GET,POST`.
- `N8N_MCP_ALLOWED_PATHS`:
  - Comma-separated path patterns (supports `*`) relative to `N8N_API_URL` base path.
  - Examples: `N8N_MCP_ALLOWED_PATHS=/workflows*,/executions*` (allows workflows/executions)
  - Default: `*` (allow all paths under the configured API origin).
- `N8N_MCP_RATE_LIMIT` and `N8N_MCP_RATE_WINDOW_MS`:
  - Basic rate limiting per process (default: `60` calls per `60000` ms).
  - Example: `N8N_MCP_RATE_LIMIT=30 N8N_MCP_RATE_WINDOW_MS=60000`.

These checks apply to all tools, including the OpenAPI-generated ones. Requests use the pinned origin from `N8N_API_URL` and do not accept arbitrary URLs.

### Audit Logging

Enable minimal, safe audit logs (method, path, status, duration; no bodies or headers):

- `N8N_MCP_LOG_FILE`: path to a writable log file enables logging (e.g., `./logs/mcp-n8n.log`).
- `N8N_MCP_LOG_MAX_SIZE`: rotate when file exceeds this many bytes (default: `1048576`).
- `N8N_MCP_LOG_MAX_FILES`: keep at most N rotated files (default: `5`).
- `N8N_MCP_LOG_FORMAT`: `json` (default) or `tsv`.

Example:

`N8N_MCP_LOG_FILE=./logs/mcp-n8n.log N8N_MCP_LOG_MAX_SIZE=1048576 N8N_MCP_LOG_MAX_FILES=7 npm run mcp:n8n`

## Multi-Service Host (one process, N+1 services)

- Run: `node examples/mcp-multi-host.js --config ./services.json`
- Config example:

```
{
  "services": [
    { "name": "n8n", "type": "openapi", "specUrl": "https://your-n8n/api/v1/docs/swagger-ui-init.js", "baseUrl": "https://your-n8n/api/v1", "auth": { "kind": "header", "name": "X-N8N-API-KEY", "env": "N8N_API_KEY" } },
    { "name": "hostinger", "type": "openapi", "specFile": "./examples/specs/hostinger-api.json", "baseUrl": "https://developers.hostinger.com", "auth": { "kind": "bearer", "env": "HOSTINGER_API_TOKEN" } },
    { "name": "third", "type": "openapi", "specUrl": "https://api.example.com/openapi.json", "baseUrl": "https://api.example.com/v1", "auth": { "kind": "bearer", "env": "THIRD_TOKEN" } }
  ]
}
```

- Tools are namespaced as `<service>.<toolName>` to avoid collisions.
- The host scales to as many services as you configure (bounded by compute). Hardening envs apply globally.

### Quick Links
- Multi-host guide: `examples/multi-host-README.md`
- Example config: `examples/services.example.json`
- Sample MCP client config (Cursor/Kiro): `mcp.config.json`
- Local vendor specs: `specs/` (place your own OpenAPI specs here and reference in configs)
  - Generate services from specs: `node examples/scripts/generate-services-from-specs.js --out examples/services.generated.json`
  - Merge generated services with example config: `npm run services:merge`
  - Full refresh (lint all specs, generate, merge): `npm run services:regen`
  - Merge strategy report (keeps base on conflicts; prints conflicts):
    - `node examples/scripts/merge-services.js --base examples/services.example.json --add examples/services.generated.json --out examples/services.merged.json --strategy report --report-out examples/services.conflicts.json`
    - Or simply: `npm run services:report`
  - Lint a services config (duplicates): `npm run services:lint:config`
  - Full refresh + conflict report + config lint: `npm run services:regen:report`


## Docker Server

Wraps Docker CLI and Docker Engine API with safety gates.

- Run (stdio): `node examples/mcp-docker-server.js`
- Tools include:
  - `docker.ps`, `docker.images`, `docker.logs`
  - `docker.run` (gated by `DOCKER_ALLOW_RUN=1`; optional `DOCKER_ALLOWED_IMAGES` allowlist)
  - `docker.stop`, `docker.rm`, `docker.exec` (exec gated by `DOCKER_ALLOW_RUN=1`)
  - `docker.compose.up`, `docker.compose.down`
  - `docker.engine.request` (calls Engine API via `DOCKER_SOCK` or `DOCKER_API_HOST`)

Env:
- `DOCKER_BIN` (default `docker`), `DOCKER_COMPOSE_BIN` (default `docker`)
- `DOCKER_SOCK=/var/run/docker.sock` or `DOCKER_API_HOST=http://localhost:2375`
- `DOCKER_ALLOW_RUN=1`, `DOCKER_ALLOWED_IMAGES="nginx,redis"`
- `DEBUG_DOCKER=1` for command/API logs

Tip: Add the Docker Engine OpenAPI spec to multi-host config via `specUrl`: https://docs.docker.com/reference/api/engine/version/v1.51.yaml
