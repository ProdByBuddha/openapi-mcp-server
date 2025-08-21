/*
 * Multi-service MCP Host (stdio)
 * Loads N+1 services (Hostinger, n8n, arbitrary OpenAPI) into one process.
 *
 * Usage:
 *   node examples/mcp-multi-host.js --config ./services.json
 *
 * services.json example:
 * {
 *   "services": [
 *     { "name": "n8n", "type": "openapi", "specUrl": "https://your-n8n/api/v1/docs/swagger-ui-init.js", "baseUrl": "https://your-n8n/api/v1", "auth": { "kind": "header", "name": "X-N8N-API-KEY", "env": "N8N_API_KEY" } },
 *     { "name": "hostinger", "type": "openapi", "specFile": "./hostinger-api.json", "baseUrl": "https://developers.hostinger.com", "auth": { "kind": "bearer", "env": "HOSTINGER_API_TOKEN" } },
 *     { "name": "third", "type": "openapi", "specUrl": "https://api.example.com/openapi.json", "baseUrl": "https://api.example.com/v1", "auth": { "kind": "bearer", "env": "THIRD_TOKEN" } }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
let WebSocketServer; try { WebSocketServer = require('ws').WebSocketServer; } catch (_) { WebSocketServer = null; }

function parseArgs(argv){ const o={}; for(let i=0;i<argv.length;i++){ const t=argv[i]; if(t.startsWith('--')){ const k=t.slice(2); const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:'true'; o[k]=v;} } return o; }

async function httpGetJson(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlString);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({ protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: 'GET', headers: Object.assign({ Accept: 'application/json' }, headers) }, (res) => {
        let body = ''; res.setEncoding('utf8'); res.on('data', (c)=> body+=c); res.on('end',()=>{ try{ resolve(JSON.parse(body)); } catch(e){ reject(new Error('Non-JSON response')); } });
      });
      req.on('error', reject); req.end();
    } catch (err) { reject(err); }
  });
}

async function loadSpec(entry) {
  if (entry.specFile) return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), entry.specFile), 'utf8'));
  if (entry.specUrl) return await httpGetJson(entry.specUrl);
  throw new Error(`Service ${entry.name} missing specFile/specUrl`);
}

function buildSecurityHandlers(entry) {
  const auth = entry.auth || {};
  const valueFrom = (env, fallback) => (env ? process.env[env] : undefined) || fallback || '';
  if (auth.kind === 'bearer') {
    return { '*': ({ headers }) => { const t = valueFrom(auth.env, auth.value); if (!t) throw new Error(`Missing bearer token (env ${auth.env || 'unset'})`); headers['Authorization'] = `Bearer ${t}`; } };
  } else if (auth.kind === 'header') {
    return { '*': ({ headers }) => { const v = valueFrom(auth.env, auth.value); if (!v) throw new Error(`Missing header value (env ${auth.env || 'unset'})`); headers[auth.name || 'X-API-Key'] = v; } };
  } else if (auth.kind === 'apiKey') {
    // { kind: 'apiKey', in: 'header'|'query'|'cookie', name: 'X-API-Key', env: 'SERVICE_KEY' }
    return { '*': ({ headers, query }) => {
      const v = valueFrom(auth.env, auth.value); if (!v) throw new Error(`Missing apiKey (env ${auth.env || 'unset'})`);
      if (auth.in === 'query') { if (query) query[auth.name] = v; }
      else if (auth.in === 'cookie') { headers['Cookie'] = `${auth.name}=${encodeURIComponent(v)}`; }
      else { headers[auth.name || 'X-API-Key'] = v; }
    }};
  }
  return {};
}

async function loadService(entry, allTools) {
  const { generateMcpTools } = require('../lib/openapi-generator');
  const spec = await loadSpec(entry);
  const baseUrl = entry.baseUrl || (spec.servers && spec.servers[0] && spec.servers[0].url) || '';
  const secHandlers = buildSecurityHandlers(entry);
  const filters = entry.filters || {};
  const tools = await generateMcpTools(spec, { baseUrl, filters, securityHandlers: new Proxy(secHandlers, { get: (t, p) => t[p] || t['*'] || undefined }) });
  for (const t of tools) {
    // prefix tool names with service name to avoid collisions
    allTools.push({ name: `${entry.name}.${t.name}`, description: t.description || '', inputSchema: t.inputSchema || { type: 'object' }, handler: t.handler });
  }
}

const tools = [];

function listToolsResponse(){ return { tools: tools.map((t)=>({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || { type: 'object' } })) }; }
async function callToolByName(name, args){ const tool = tools.find((t)=>t.name===name); if(!tool) throw new Error(`Unknown tool: ${name}`); return tool.handler(args||{}); }
function writeResponse(id, result, error){ const msg={jsonrpc:'2.0',id}; if(error) msg.error=error; else msg.result=result; process.stdout.write(JSON.stringify(msg)+'\n'); }
function toRpcError(err){ return { code: -32000, message: err.message || 'Request failed', data: err.response || null }; }

async function main(){
  const args = parseArgs(process.argv.slice(2));
  const cfgPath = args.config || '';
  if (!cfgPath) { console.error('Usage: node examples/mcp-multi-host.js --config ./services.json [--transport stdio|http|sse|ws]'); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), cfgPath), 'utf8'));
  const entries = Array.isArray(cfg.services) ? cfg.services : [];
  if (!entries.length) { console.error('No services in config'); process.exit(1); }
  for (const entry of entries) { await loadService(entry, tools); }
  const transport = (args.transport || 'stdio').toLowerCase();
  if (transport === 'http') {
    const app = express();
    app.use(bodyParser.json());
    app.post('/mcp', async (req, res) => {
      try {
        const { method, params } = req.body || {};
        if (method === 'tools/list') return res.json(listToolsResponse());
        if (method === 'tools/call') {
          const result = await callToolByName(params?.name, params?.arguments || {});
          return res.json({ content: [{ type: 'json', json: result }] });
        }
        return res.status(400).json({ error: 'Unknown method' });
      } catch (e) { return res.status(500).json({ error: e.message }); }
    });
    const port = process.env.PORT || 3005;
    app.listen(port, () => console.log(`[multi-host] HTTP listening on ${port}`));
  } else if (transport === 'sse') {
    const app = express();
    app.use(bodyParser.json());
    app.get('/mcp-sse', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
      send({ message: 'MCP SSE connection established.' });
    });
    const port = process.env.PORT || 3006;
    app.listen(port, () => console.log(`[multi-host] SSE listening on ${port}`));
  } else if (transport === 'ws' || transport === 'websocket') {
    if (!WebSocketServer) { console.error('WS transport requested but ws is not installed'); process.exit(1); }
    const app = express();
    app.use(bodyParser.json());
    const server = app.listen(process.env.PORT || 3007, () => console.log(`[multi-host] WS listening`));
    const wss = new WebSocketServer({ server, path: '/mcp' });
    wss.on('connection', (ws) => {
      ws.on('message', async (msg) => {
        try {
          const data = JSON.parse(String(msg));
          const { method, params } = data || {};
          if (method === 'tools/list') return ws.send(JSON.stringify(listToolsResponse()));
          if (method === 'tools/call') {
            const result = await callToolByName(params?.name, params?.arguments || {});
            return ws.send(JSON.stringify({ content: [{ type: 'json', json: result }] }));
          }
          ws.send(JSON.stringify({ error: 'Unknown method' }));
        } catch (e) { ws.send(JSON.stringify({ error: e.message })); }
      });
    });
  } else {
    // stdio loop
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
      buffer += chunk; let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim(); buffer = buffer.slice(idx + 1);
        if (!line) continue; let msg; try { msg = JSON.parse(line); } catch (_) { writeResponse(null, null, { code: -32700, message: 'Parse error' }); continue; }
        const { id, method, params } = msg || {};
        if (method === 'initialize') { writeResponse(id, { protocolVersion: '2024-11-05', serverInfo: { name: 'mcp-multi-host', version: '1.3.2' }, capabilities: { tools: {} } }); continue; }
        if (method === 'tools/list') { writeResponse(id, listToolsResponse()); continue; }
        if (method === 'tools/call') {
          try { const result = await callToolByName(params?.name, params?.arguments || {}); writeResponse(id, { content: [{ type: 'json', json: result }] }); }
          catch (err) { writeResponse(id, null, toRpcError(err)); }
          continue;
        }
        writeResponse(id, null, { code: -32601, message: `Unknown method: ${method}` });
      }
    });
  }
}

main().catch((e)=>{ console.error('Fatal:', e.message); process.exit(1); });
