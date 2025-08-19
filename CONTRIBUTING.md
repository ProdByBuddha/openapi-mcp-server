# Contributing

Thanks for your interest in contributing! This project aims to integrate MCP server and CLI utilities for n8n.

For upstreaming to n8n, please follow the official guidelines:

- n8n contribution guidelines: https://github.com/n8n-io/n8n/blob/master/CONTRIBUTING.md

Local development

- Node.js 18+ recommended
- Install deps: `npm install`
- Run tests: `N8N_API_URL='<base>/api/v1' N8N_API_KEY='<key>' npm test`
  - If env vars are not set, E2E is skipped; unit tests still run in dry-run mode.
- Start MCP server: `N8N_API_URL='<base>/api/v1' N8N_API_KEY='<key>' npm run mcp:n8n`

Code style

- Keep changes minimal and focused
- Avoid committing secrets; use `.env` and `.env.example`
- Prefer async/await and small, testable functions

Security

- Use short‑lived API keys for testing
- Do not log request bodies or headers
- See `SECURITY.md` for hardening options and logging controls

- Repo layout conventions
  - Place bundled example OpenAPI specs under `examples/specs/` (these may be linted and referenced by examples and docs).
  - Place local/vendor/private specs under `specs/` and reference them explicitly in configs (e.g., `examples/services.example.json`).
  - Put ad‑hoc or helper scripts under `examples/scripts/` rather than the project root.
  - Avoid adding large binary artifacts to the repo; prefer linking or generating at build/test time.

