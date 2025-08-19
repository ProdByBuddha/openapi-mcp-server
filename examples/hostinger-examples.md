# Hostinger Examples

This guide shows a few common calls using the Hostinger MCP server in this repo.

Prerequisites:
- Set your token: `export HOSTINGER_API_TOKEN=...`
- Optional: `export DEBUG_HTTP=1` to log summarized HTTP requests/responses.

List catalog items:

```
node examples/mcp-hostinger-server.js --once billing_getCatalogItemListV1 '{"category":"vps"}'
```

List domains (owned by your account):

```
node examples/mcp-hostinger-server.js --once domains_getDomainListV1 '{}'
```

Check domain availability:

```
node examples/mcp-hostinger-server.js --once domains_checkDomainAvailabilityV1 '{"domain":"example.com"}'
```

Notes:
- Tool names come from the OpenAPI `operationId`. Use `--once tools/list {}` to inspect names and input schemas.
- If a tool requires path parameters, include them in the arguments object using the parameter names.
- The server enforces optional hardening via `OPENAPI_MCP_ALLOWED_*` env vars.

