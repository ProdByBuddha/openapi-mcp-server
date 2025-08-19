# Release Checklist

Use this checklist to prepare and publish a new release securely.

## Pre-flight
- [ ] Confirm LICENSE holder: Billy Coleman III
- [ ] Bump version in `package.json` (semver)
- [ ] Update `CHANGELOG.md` (if present)
- [ ] Regenerate MCP tools from your API (optional):
  - `N8N_API_KEY='<key>' npm run mcp:gen -- --from-url https://<your-host>/api/v1/docs/swagger-ui-init.js`
  - `npm run mcp:tools:readme`
- [ ] Verify `.npmignore` excludes `data/`, `backups/`, dumps, and ops-only files

## Test & Verify
- [ ] Run unit/smoke tests: `npm test`
- [ ] Build MCP tools README: `npm run mcp:tools:readme`
- [ ] Package dry run: `npm pack`
  - Inspect the tarball contents:
    - No `.env` or secrets
    - No `backups/` or `data/`
    - Example scripts present as intended

## Security
- [ ] Rotate any short-lived API keys used during generation/testing
- [ ] Review `SECURITY.md` and update contacts if necessary
- [ ] (Optional) Run local secret scan e.g. `gitleaks detect --no-git --source .`

## Publish
- [ ] Commit and tag: `git tag vX.Y.Z && git push --tags`
- [ ] Create a GitHub release (Release Drafter will prepare notes)
- [ ] npm publish happens automatically when the tag/release is pushed (requires `NPM_TOKEN` repo secret)

## Post-release
- [ ] Verify CI runs green on the tagged commit
- [ ] Announce/update docs if needed
