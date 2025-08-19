# n8n MCP Server (n8n-mcp-server)

[![npm version](https://img.shields.io/npm/v/n8n-mcp-server?logo=npm&color=cb0000)](https://www.npmjs.com/package/n8n-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/ProdByBuddha/n8n-mcp-server?sort=semver)](https://github.com/ProdByBuddha/n8n-mcp-server/releases)

MCP server + CLI for n8n. It generates MCP tools directly from the official n8n Public API (OpenAPI), exposes them over stdio (initialize, tools/list, tools/call), and includes a small CLI for listing/exporting/updating workflows.

No credentials are stored; set env vars when running.

## Install

- From npm (use inside your project):
  - `npm install n8n-mcp-server`
  - Run server: `N8N_API_URL='https://your-n8n/api/v1' N8N_API_KEY='<key>' node node_modules/n8n-mcp-server/examples/mcp-n8n-server.js`

- From source (clone/fork):
  - `npm install`
  - `N8N_API_URL='https://your-n8n/api/v1' N8N_API_KEY='<key>' npm start`

## Generate Tools (recommended)

- From URL (OpenAPI via Swagger UI):
  - `N8N_API_KEY='<key>' npm run mcp:gen -- --from-url https://your-n8n/api/v1/docs/swagger-ui-init.js`
- From file (if you have a JSON spec):
  - `npm run mcp:gen -- --from-file path/to/openapi.json`
- Build index (pretty list):
  - `npm run mcp:tools:readme` → writes `examples/generated/TOOLS.md`

## Configuration

Set environment variables directly or via `.env` (see `.env.example`):
- `N8N_API_URL`: Base API URL ending with `/api/v1`
- `N8N_API_KEY`: API key sent as `X-N8N-API-KEY`
- Optional: `N8N_BEARER_TOKEN`, `N8N_BASIC_AUTH_USER/PASS`

## Tests

- End-to-end: `N8N_API_URL=... N8N_API_KEY=... npm test`
  - Generates tools, calls the MCP server over stdio, and asserts workflows can be listed.
- Auto-generated unit tests: The test runner creates a dry-run unit test for every OpenAPI tool and executes it (no network).

## CI (optional)

The repo includes sample GitHub Actions workflows (in `.github/workflows/`):
- `CI`: installs deps and runs tests. E2E runs only if repo secrets are configured.
- `Update Generated MCP Tools`: regenerates OpenAPI tools on a schedule or manual dispatch.

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

Created by Billy Coleman III. Maintained with contributions from the n8n community.

## Authorship & License

- License: MIT. See `LICENSE` and `NOTICE` for attribution guidance.
- Authorship: Original work by Billy Coleman III; evolved by community contributions.
- Upstreaming: When contributing to the n8n-io org, license headers may follow their repository standard. Authorship remains in commit history and can also be acknowledged in README/NOTICE.

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
