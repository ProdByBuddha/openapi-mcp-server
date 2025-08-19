Changelog

All notable changes to this project will be documented in this file.

1.1.0 - 2025-08-19
- Inline OpenAPI generator into main package under `lib/openapi-generator`.
- Add subpath export `n8n-mcp-server/lib/openapi-generator` for programmatic use.
- Dynamic OpenAPI tool loading via `OPENAPI_SPEC_FILE` / `OPENAPI_SPEC_URL` envs.
- Refactor CLI `examples/generate-n8n-mcp-tools.js` to use bundled generator.
- Add smoke test and stabilize unit tests to use runtime tool listing.
- Documentation updates and example improvements.

1.0.0 - 2025-08-19
- Initial release of n8n MCP server with example CLI and tests.

