Changelog

All notable changes to this project will be documented in this file.

1.2.1 - 2025-08-19
- Add support for building and publishing the GitHub wiki.
- Enhance wiki styling and add support/donation links.
- Rename OpenAPI generator CLI to `generate-openapi-mcp-tools.js`.
- Update documentation and examples.

1.2.0 - 2025-08-19
- Rename package to `@prodbybuddha/openapi-mcp-server` to reflect generalized scope.
- Make generic OpenAPI server the primary entry point.
- Keep n8n-specific server available under `examples/mcp-n8n-server.js`.
- Update exports, README, and repository links.

1.1.1 - 2025-08-19
- Publish under scoped name `@prodbybuddha/n8n-mcp-server` on npm.
- Update README imports to use scoped path export.

1.1.0 - 2025-08-19
- Inline OpenAPI generator into main package under `lib/openapi-generator`.
- Add subpath export `n8n-mcp-server/lib/openapi-generator` for programmatic use.
- Dynamic OpenAPI tool loading via `OPENAPI_SPEC_FILE` / `OPENAPI_SPEC_URL` envs.
- Refactor CLI `examples/generate-n8n-mcp-tools.js` to use bundled generator.
- Add smoke test and stabilize unit tests to use runtime tool listing.
- Documentation updates and example improvements.

1.0.0 - 2025-08-19
- Initial release of n8n MCP server with example CLI and tests.