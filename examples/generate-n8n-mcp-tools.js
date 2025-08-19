/*
 * Generate MCP tool definitions from an OpenAPI spec.
 * - Input: --from-url <url> or --from-file <path>
 * - Output: --out <path> (default: examples/generated/n8n-openapi-tools.json)
 * - Auth (optional): N8N_API_KEY sent as X-N8N-API-KEY
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    } else out._.push(t);
  }
  return out;
}

function httpGet(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          headers: Object.assign({ Accept: 'application/json' }, headers)
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }
      );
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sanitizeName(s) {
  return String(s).replace(/[^A-Za-z0-9_.:-]/g, '_');
}

function opToToolName(base, op) {
  // Prefer operationId if present; else method + path
  if (op.operationId) return `${base}.${sanitizeName(op.operationId)}`;
  return `${base}.${op.__method.toLowerCase()}_${sanitizeName(op.__path.replace(/\//g, '_').replace(/\{\}/g, ''))}`;
}

function buildInputSchema(op) {
  const schema = {
    type: 'object',
    properties: {
      // path params flattened
    }
  };
  const required = [];
  const pathParams = [];
  if (Array.isArray(op.parameters)) {
    for (const p of op.parameters) {
      if (p.in === 'path') {
        const name = p.name;
        pathParams.push(name);
        schema.properties[name] = { type: 'string', description: p.description || undefined };
        if (p.required) required.push(name);
      }
    }
  }
  // optional query and body
  schema.properties.query = { type: 'object', additionalProperties: true };
  if (op.requestBody) {
    schema.properties.body = { type: 'object' };
  }
  if (required.length) schema.required = required;
  return schema;
}

function generateToolsFromOpenApi(spec, basePrefix = 'n8n.v1') {
  const tools = [];
  if (!spec || !spec.paths) return tools;
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const opObj = Object.assign({}, op, { __method: method, __path: p });
      const tag = (Array.isArray(op.tags) && op.tags[0]) || 'api';
      const base = `${basePrefix}.${sanitizeName(tag)}`;
      const name = opToToolName(base, opObj);
      const description = op.summary || op.description || `${method.toUpperCase()} ${p}`;
      const inputSchema = buildInputSchema(opObj);
      tools.push({ name, description, method: method.toUpperCase(), pathTemplate: p, inputSchema });
    }
  }
  return tools;
}

function writeOut(filePath, tools) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), tools }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out || path.resolve(__dirname, 'generated', 'n8n-openapi-tools.json');
  let spec;
  if (args['from-file']) {
    spec = JSON.parse(fs.readFileSync(args['from-file'], 'utf8'));
  } else if (args['from-url']) {
    const headers = {};
    if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
    const res = await httpGet(args['from-url'], headers);
    if (res.status < 200 || res.status >= 300) throw new Error(`Fetch failed: HTTP ${res.status}`);
    try {
      spec = JSON.parse(res.body);
    } catch (_) {
      // Try to extract swaggerDoc JSON from a JS init file
      const body = String(res.body);
      const idx = body.indexOf('"swaggerDoc"');
      if (idx === -1) throw new Error('Response is not JSON and no swaggerDoc found');
      const braceStart = body.indexOf('{', idx);
      if (braceStart === -1) throw new Error('Could not locate swaggerDoc object');
      let i = braceStart;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (; i < body.length; i++) {
        const ch = body[i];
        if (inStr) {
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inStr = false; continue; }
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth++;
        if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
      }
      const jsonStr = body.slice(braceStart, i);
      const doc = JSON.parse(jsonStr);
      spec = doc;
    }
  } else {
    console.error('Usage: node examples/generate-n8n-mcp-tools.js --from-url <url> | --from-file <path> [--out <path>]');
    process.exit(1);
  }

  const prefix = spec.info && spec.info.version ? `n8n.v${String(spec.info.version).split('.')[0]}` : 'n8n.v1';
  const tools = generateToolsFromOpenApi(spec, prefix);
  writeOut(outPath, tools);
  console.log(`Generated ${tools.length} tools -> ${outPath}`);
}

main();
