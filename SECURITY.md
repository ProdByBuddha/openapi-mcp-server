# Security Policy

## Supported Versions

The latest `master` branch is supported. Please update to the latest version before reporting issues.

## Reporting a Vulnerability

- Email: thebuddhaverse@icloud.com (or open a private issue)
- Please include: steps to reproduce, affected versions, and any PoC.
- We respond within 72 hours. Critical issues will be triaged immediately.

## Handling Secrets

- Do not commit secrets. Use environment variables via `.env` (see `.env.example`).
- Rotate short-lived API keys after testing. Revoke leaked keys immediately.
- Prefer `X-N8N-API-KEY` over Bearer if your deployment requires it.
- Avoid disabling TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`) except in ephemeral dev setups.

## Secure Defaults

- `.npmignore` excludes local data and generated artifacts from the package.
- Example scripts read credentials from `process.env` only.
- CLI tools do not persist tokens to disk.

## Additional Guidance

- Review Docker Compose files before deploying to production.
- Restrict n8n API exposure behind auth and TLS.
- Use role-based API keys where possible; limit scope and lifetime.
