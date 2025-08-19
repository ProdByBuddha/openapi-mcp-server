# Generated MCP Server (TypeScript)

This project was generated from an OpenAPI spec. It includes:
- Transports: stdio, HTTP, SSE, WebSocket
- Validation: Zod schemas inferred from OpenAPI
- Minimal HTTP client with timeouts

## Run

- Dev: `npm run dev` (ts-node)
- Build: `npm run build`
- Start (HTTP): `npm start` (uses `dist/index.js`; default transport HTTP)
- Change transport: `node dist/index.js --transport stdio|http|sse|ws`

## HTTP mode

POST `/mcp` with JSON-RPC-like payloads:
- `{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}`
- `{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"<tool>","arguments":{}}}`

## Typed WS/SSE client snippets

### WebSocket client

```ts
import { connectWs } from './ws-client';
(async () => {
  const { call } = connectWs('ws://localhost:3001/mcp');
  const list = await call('tools/list', {});
  console.log('tools:', list);
  const res = await call('tools/call', { name: '<toolName>', arguments: {} });
  console.log('call result:', res);
})();
```

### SSE client

```ts
import { connectSse } from './sse-client';
const es = connectSse('http://localhost:3001/mcp-sse', (data) => {
  console.log('SSE:', data);
});
// later: es.close();
```

## Hardening

Use environment variables to restrict behavior globally:
- `OPENAPI_MCP_ALLOWED_METHODS=GET,POST` (default allows common methods)
- `OPENAPI_MCP_ALLOWED_PATHS=/v1/*` (allowlist of paths)
- `OPENAPI_MCP_RATE_LIMIT=60 OPENAPI_MCP_RATE_BURST=30 OPENAPI_MCP_RATE_WINDOW_MS=60000`
- `OPENAPI_MCP_CONCURRENCY=8 OPENAPI_MCP_CONCURRENCY_PER_PATH=4`
- `DEBUG_HTTP=1` to enable request/response summaries (auth redacted)
