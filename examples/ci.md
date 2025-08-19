# CI Tips

This project includes example GitHub Actions workflows under `.github/workflows/`.

## Secrets and E2E Tests

End-to-end tests contact a live n8n API. They are skipped unless the following secrets are configured in your repository:

- `N8N_API_URL`: The base URL ending with `/api/v1`.
- `N8N_API_KEY`: Your API key.

The CI job passes these secrets to `npm test`. Without them, the e2e will no-op and exit early.

## Coverage

Coverage is run with `c8` and uploaded as an artifact (`coverage/lcov.info`). You can integrate this with coverage services or download it from the Actions run.

## Gating Live Tests Locally

When running locally, you can set the two environment variables above in `.env` at the repo root or export them in your shell.

Example:

```
N8N_API_URL=https://your-n8n/api/v1 \
N8N_API_KEY=xxxxxxxxxxxxxxxxxxxx \
npm test
```

## Debugging HTTP

To debug HTTP requests/responses in generated servers or the local generator, set:

```
DEBUG_HTTP=1
```

This prints outbound request headers (with auth redacted) and response status lines.

