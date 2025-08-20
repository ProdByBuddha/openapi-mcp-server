Changelog

All notable changes to this project will be documented in this file.

1.3.0 - 2025-08-20

### Added
- GitHub Actions workflow: auto-build and publish the GitHub Wiki on docs/spec changes, releases, and manual dispatch (`.github/workflows/update-wiki.yml`).
- Spec pipeline: regenerate tools from `examples/specs/*.{json,yaml,yml}` and rebuild `examples/generated/TOOLS.md` before publishing the Wiki.
- Linting: run `openapi:lint:all` for `specs/**` and lint `examples/specs/*.json` in CI prior to generation.
- Wiki footer: include a collapsible “Crypto wallets” section populated from `donate.json`.
- OpenAPI generator: recognize `x-eov-operation-id` (e.g., n8n) when `operationId` is absent, improving tool coverage.

### Changed
- Wiki builder: include `VIBE.md` in the Wiki and Sidebar navigation.
- Workflow: removed duplicate early Tools README rebuild step to avoid double work.

### Fixed
- README: correct link to `VIBE.md` in the Documentation section.

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
1.3.0 - 2025-08-19

### Added
- WebSocket transport for generated servers (`--transport ws`), template now depends on `ws`.
- `DEBUG_HTTP` env to toggle HTTP request/response logging in generated servers.
- Live auth tests for apiKey/bearer/basic and serialization unit tests for all auth schemes.
- Scripts: `mcp:gen:tools`, `mcp:gen:server`; examples/README with quickstarts.
- CI coverage via `c8` and artifact upload of `lcov`.

### Changed
- Generator now preserves OAuth2 `clientCredentials.tokenUrl` and includes `paramName` for `apiKey` schemes in `serializationInfo.security`.
- Generated server templates hardened with method/path allowlists and rate limiting controls (`OPENAPI_MCP_*`).
- Improved validation: Zod conversion respects `required`, supports non-string enums, and keeps constraints.
- OAuth2 client credentials flow adds basic retry/backoff, timeouts, and in-memory token caching.
