# Release Checklist

Use this checklist to cut a new release confidently.

Preflight
- npm ci
- npm run lint
- npm test && npm run test:coverage
- node cli.js --help (basic smoke test)

Versioning & Changelog
- Update CHANGELOG.md with the changes since last release.
- Choose version bump: npm version patch|minor|major (auto-creates tag).

Publish & Push
- git push && git push --tags
- npm publish --access public

Post-Release
- Create a GitHub Release from the tag; paste the changelog.
- Update README CI badge owner/repo if needed.
- Verify npm page (description, README, keywords) and badges render.

Backfilling a 1.0.0 tag
- Ensure `package.json` version is `1.0.0` and `CHANGELOG.md` has a `1.0.0` section.
- Create an annotated tag at the current commit:
  - git tag -a v1.0.0 -m "1.0.0"
  - git push origin v1.0.0
- Then create the GitHub release from that tag.
