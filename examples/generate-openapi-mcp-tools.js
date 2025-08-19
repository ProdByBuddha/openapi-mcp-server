/*
 * Generate MCP tool definitions from an OpenAPI spec using the bundled
 * openapi generator. Produces a serializable JSON file that the
 * server can load offline.
 *
 * - Input: --from-url <url> or --from-file <path>
 * - Output: --out <path> (default: examples/generated/n8n-openapi-tools.json)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { generateMcpTools } = require('../lib/openapi-generator');

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

async function loadSpecFromUrl(url) {
  const headers = {};
  if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;
  const res = await httpGet(url, headers);
  if (res.status < 200 || res.status >= 300) throw new Error(`Fetch failed: HTTP ${res.status}`);
  try {
    return JSON.parse(res.body);
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
    return JSON.parse(jsonStr);
  }
}

function writeOut(filePath, tools) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  // Strip functions; keep serializable metadata for offline use
  const serializable = tools.map((t) => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || { type: 'object' },
    method: t.method || 'GET',
    pathTemplate: t.pathTemplate || ''
  }));
  fs.writeFileSync(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), tools: serializable }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = args.out || path.resolve(__dirname, 'generated', 'n8n-openapi-tools.json');
  let spec;
  if (args['from-file']) {
    spec = JSON.parse(fs.readFileSync(args['from-file'], 'utf8'));
  } else if (args['from-url']) {
    spec = await loadSpecFromUrl(args['from-url']);
  } else {
    console.error('Usage: node examples/generate-openapi-mcp-tools.js --from-url <url> | --from-file <path> [--out <path>]');
    process.exit(1);
  }

  const baseUrl = args.baseUrl || process.env.OPENAPI_BASE_URL || process.env.N8N_API_URL || undefined;
  const tools = await generateMcpTools(spec, { baseUrl });
  writeOut(outPath, tools);
  console.log(`Generated ${tools.length} tools -> ${outPath}`);
}

main();

