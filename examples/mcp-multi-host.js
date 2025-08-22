#!/usr/bin/env node
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

// Load environment variables early (dotenvx via CLI recommended; fallback to dotenv here)
try { require('dotenv').config(); } catch (_) {}

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const express = require('express');
let soap; try { soap = require('soap'); } catch (_) { soap = null; }
const bodyParser = require('body-parser');
let WebSocketServer; try { WebSocketServer = require('ws').WebSocketServer; } catch (_) { WebSocketServer = null; }

function parseArgs(argv){ const o={}; for(let i=0;i<argv.length;i++){ const t=argv[i]; if(t.startsWith('--')){ const k=t.slice(2); const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:'true'; o[k]=v;} } return o; }

function expandEnv(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const v = process.env[String(key)];
    return v !== undefined ? v : `
${'{'}${key}}`;
  });
}

async function httpGetJson(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout after 10 seconds for ${urlString}`));
    }, 10000);

    try {
      const u = new URL(urlString);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        timeout: 10000,
        headers: Object.assign({ Accept: 'application/json, application/yaml, text/javascript, application/javascript' }, headers)
      }, (res) => {
        clearTimeout(timeout);
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c)=> body+=c);
        res.on('end',()=>{
          if (urlString.endsWith('.js')) {
            try {
              const jsonp = body.substring(body.indexOf('{'), body.lastIndexOf('}') + 1);
              resolve(JSON.parse(jsonp));
              return;
            } catch (e) {
              reject(new Error(`Failed to parse JSON from JS file: ${e.message}`));
              return;
            }
          }
          // Try JSON first
          try { resolve(JSON.parse(body)); return; } catch (_) {}
          // Try YAML if available
          try { const YAML = require('yaml'); resolve(YAML.parse(body)); return; } catch (_) {}
          // If neither works, reject with more specific error
          reject(new Error(`Response is not valid JSON or YAML. Content-Type: ${res.headers['content-type']}, Status: ${res.statusCode}`));
        });
      });
      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      req.on('timeout', () => {
        clearTimeout(timeout);
        req.destroy();
        reject(new Error(`Request timeout for ${urlString}`));
      });
      req.end();
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

async function loadSpec(entry) {
  const specFile = expandEnv(entry.specFile);
  const specUrl = expandEnv(entry.specUrl);
  if (specFile) return path.resolve(process.cwd(), specFile); // return path string so swagger-parser can resolve $ref relative to file
  if (specUrl) return specUrl; // return URL string so swagger-parser can resolve remote $ref relative to URL
  throw new Error(`Service ${entry.name} missing specFile/specUrl`);
}

async function loadSoapService(entry, allTools) {
  if (!soap) { console.warn(`[${entry.name}] SOAP requested but 'soap' package not installed`); return; }
  const wsdl = expandEnv(entry.wsdlUrl || entry.wsdlFile);
  if (!wsdl) { console.warn(`[${entry.name}] Missing wsdlUrl/wsdlFile`); return; }
  try {
    const client = await soap.createClientAsync(wsdl, entry.soapOptions || {});
    if (entry.endpoint) client.setEndpoint(expandEnv(entry.endpoint));
    const desc = client.describe();
    const toolsLocal = [];
    const services = Object.keys(desc || {});
    for (const svcName of services) {
      const ports = desc[svcName] || {};
      for (const portName of Object.keys(ports)) {
        const ops = ports[portName] || {};
        for (const opName of Object.keys(ops)) {
          const tName = `${opName}`;
          const inputSchema = { type: 'object', properties: { body: { type: 'object', description: 'SOAP request payload (object matching WSDL input)' }, headers: { type: 'object', description: 'Optional HTTP headers' } } };
          const handler = async (args = {}) => {
            const payload = args.body || {};
            if (args.headers && typeof args.headers === 'object') client.addHttpHeader(args.headers);
            const fn = client[`${opName}Async`];
            if (typeof fn !== 'function') throw new Error(`SOAP operation not callable: ${opName}`);
            const [result, raw, soapHeader] = await fn.call(client, payload);
            return { result, raw, soapHeader };
          };
          toolsLocal.push({ name: tName, description: `SOAP ${svcName}.${portName}.${opName}`, inputSchema, handler });
        }
      }
    }
    for (const t of toolsLocal) allTools.push({ name: `${entry.name}.${t.name}`, description: t.description, inputSchema: t.inputSchema, handler: t.handler });
    console.error(`[${entry.name}] Loaded ${toolsLocal.length} SOAP tools`);
  } catch (e) {
    console.warn(`[${entry.name}] Failed to load SOAP service: ${e.message}`);
  }
}

function buildSecurityHandlers(entry) {
  const auth = entry.auth || {};
  const valueFrom = (env, fallback) => (env ? process.env[env] : undefined) || fallback || '';

  // Check if required auth is available
  if (auth.kind && auth.env && !valueFrom(auth.env)) {
    return { available: false, reason: `Missing environment variable: ${auth.env}` };
  }

  if (auth.kind === 'bearer') {
    return { available: true, '*': ({ headers }) => { const t = valueFrom(auth.env, auth.value); if (!t) throw new Error(`Missing bearer token (env ${auth.env || 'unset'})`); headers['Authorization'] = `Bearer ${t}`; } };
  } else if (auth.kind === 'header') {
    return { available: true, '*': ({ headers }) => { const v = valueFrom(auth.env, auth.value); if (!v) throw new Error(`Missing header value (env ${auth.env || 'unset'})`); headers[auth.name || 'X-API-Key'] = v; } };
  } else if (auth.kind === 'apiKey') {
    // { kind: 'apiKey', in: 'header'|'query'|'cookie', name: 'X-API-Key', env: 'SERVICE_KEY' }
    return { available: true, '*': ({ headers, query }) => {
      const v = valueFrom(auth.env, auth.value); if (!v) throw new Error(`Missing apiKey (env ${auth.env || 'unset'})`);
      if (auth.in === 'query') { if (query) query[auth.name] = v; }
      else if (auth.in === 'cookie') { headers['Cookie'] = `${auth.name}=${encodeURIComponent(v)}`; }
      else { headers[auth.name || 'X-API-Key'] = v; }
    }};
  }
  return { available: true };
}

async function loadService(entry, allTools) {
  const { generateMcpTools } = require('../lib/openapi-generator');
  
  // Check if auth is available before loading the service
  const secHandlers = buildSecurityHandlers(entry);
  if (secHandlers.available === false) {
    console.warn(`[${entry.name}] Skipping service: ${secHandlers.reason}`);
    return;
  }
  
  try {
    const spec = await loadSpec(entry);
    const baseUrlRaw = entry.baseUrl || (spec.servers && spec.servers[0] && spec.servers[0].url) || '';
    const baseUrl = expandEnv(baseUrlRaw);
    const filters = entry.filters || {};
    const tools = await generateMcpTools(spec, { baseUrl, filters, securityHandlers: new Proxy(secHandlers, { get: (t, p) => t[p] || t['*'] || undefined }) });
    for (const t of tools) {
      // prefix tool names with service name to avoid collisions
      allTools.push({ name: `${entry.name}.${t.name}`, description: t.description || '', inputSchema: t.inputSchema || { type: 'object' }, handler: t.handler });
    }
    console.error(`[${entry.name}] Loaded ${tools.length} tools`);
  } catch (error) {
    console.warn(`[${entry.name}] Failed to load service: ${error.message}`);
  }
}

const tools = [];

function listToolsResponse(){ return { tools: tools.map((t)=>({ name: t.name, description: t.description || '', inputSchema: t.inputSchema || { type: 'object' } })) }; }
async function callToolByName(name, args){ const tool = tools.find((t)=>t.name===name); if(!tool) throw new Error(`Unknown tool: ${name}`); return tool.handler(args||{}); }
function writeResponse(id, result, error){ const msg={jsonrpc:'2.0',id}; if(error) msg.error=error; else msg.result=result; process.stdout.write(JSON.stringify(msg)+'\n'); }
function toRpcError(err){ return { code: -32000, message: err.message || 'Request failed', data: err.response || null }; }

async function loadServices(){
  const args = parseArgs(process.argv.slice(2));
  const cfgPath = args.config || process.argv[2] || path.join(__dirname, '..', 'services.default.json');
  const fullCfgPath = path.resolve(cfgPath);
  process.chdir(path.dirname(fullCfgPath));
  const cfg = JSON.parse(fs.readFileSync(fullCfgPath, 'utf8'));
  const entries = Array.isArray(cfg.services) ? cfg.services : [];
  if (!entries.length) { console.error('No services in config'); process.exit(1); }
  for (const entry of entries) {
    const type = String(entry.type || 'openapi').toLowerCase();
    if (type === 'soap') await loadSoapService(entry, tools);
    else await loadService(entry, tools);
  }
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
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

async function maybeOnce() {
  const args = process.argv.slice(2);
  const onceIndex = args.indexOf('--once');
  if (onceIndex === -1) return false;
  
  const method = args[onceIndex + 1];
  const params = args[onceIndex + 2] ? JSON.parse(args[onceIndex + 2]) : {};
  
  try {
    if (method === 'tools/list') { 
      console.log(JSON.stringify(listToolsResponse(), null, 2)); 
      return true; 
    }
    if (method === 'tools/call') {
      const result = await callToolByName(params?.name, params?.arguments || {});
      console.log(JSON.stringify(result, null, 2));
      return true;
    }
    throw new Error(`Unknown method: ${method}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
    return true;
  }
}

(async () => {
  // Always load services first
  await loadServices();
  
  // Then check if this is a --once call
  if (await maybeOnce()) return;
  
  // Otherwise run the main transport loop
  await main();
})().catch((e)=>{ console.error('Fatal:', e.message); process.exit(1); });
