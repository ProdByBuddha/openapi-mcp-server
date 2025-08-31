// End-to-end test for the MCP server against a live n8n API
// Skips if N8N_API_URL or N8N_API_KEY are not set

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dotenvx;
try { 
  const dotenvxModule = await import('@dotenvx/dotenvx');
  dotenvx = dotenvxModule.default || dotenvxModule;
} catch (_) { 
  try { 
    const dotenvModule = await import('dotenv');
    dotenvx = dotenvModule.default || dotenvModule;
  } catch (_) { 
    dotenvx = null; 
  }
}

// Minimal .env loader (same logic as run-all.js)
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || /^\s*#/.test(line)) continue;
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (!(val.startsWith('"') && val.endsWith('"')) && !(val.startsWith("'") && val.endsWith("'"))) {
        const hash = val.indexOf(' #');
        if (hash !== -1) val = val.slice(0, hash).trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    return true;
  } catch (_) { return false; }
}

// Try common .env locations relative to this file
const dir = __dirname;
const envCandidates = [
  path.resolve(dir, '..', '.env'),
  path.resolve(dir, '..', '..', '.env'),
  path.resolve(process.cwd(), '.env')
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    if (dotenvx) dotenvx.config({ path: p, override: false });
    loadEnvFile(p);
  }
}

function log(msg) { process.stdout.write(msg + '\n'); }

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function runNode(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${err || out}`));
    });
  });
}

async function generateTools() {
  const apiUrl = requireEnv('N8N_API_URL').replace(/\/$/, '');
  const specUrl = `${apiUrl}/docs/swagger-ui-init.js`;
  const genScript = path.resolve(__dirname, '..', 'examples', 'scripts', 'generate-openapi-mcp-tools.js');
  const outPath = path.resolve(__dirname, '..', 'examples', 'generated', 'n8n-openapi-tools.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  log(`Generating tools from: ${specUrl}`);
  await runNode(process.execPath, [genScript, '--from-url', specUrl, '--out', outPath], {
    N8N_API_KEY: requireEnv('N8N_API_KEY')
  });
  if (!fs.existsSync(outPath)) throw new Error('Generated tools file missing');
  log('Tools generated.');
}

async function mcpCall(name, args, env) {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-n8n-server.js')], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let buf = '';
    let err = '';
    let resolved = false;
    const finish = (fn) => {
      if (resolved) return; resolved = true; try { fn(); } finally { try { srv.kill(); } catch (_) { } }
    };
    srv.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\n+/).filter(Boolean);
      try {
        for (const line of lines) {
          const msg = JSON.parse(line);
          if (msg && (msg.result || msg.error)) {
            if (msg.error) return finish(() => reject(new Error(`MCP error: ${JSON.stringify(msg.error)}`)));
            return finish(() => resolve(msg.result));
          }
        }
      } catch (_) {
        // keep buffering until we have full JSON lines
      }
    });
    srv.stderr.on('data', (d) => (err += d.toString()));
    srv.on('error', (e) => finish(() => reject(e)));
    const t = setTimeout(() => finish(() => reject(new Error(`Timed out waiting for MCP response. Stderr: ${err}`))), 20000);
    // Send a single tools/call and then end stdin
    const msg = { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name, arguments: args || {} } };
    srv.stdin.write(JSON.stringify(msg) + '\n');
    srv.stdin.end();
  });
}

(async () => {
  try {
    // Accept fallbacks if primary vars missing
    const url = process.env.N8N_API_URL || process.env.N8N_URL;
    const key = process.env.N8N_API_KEY || process.env.N8N_TOKEN || process.env.N8N_BEARER_TOKEN;
    if (!url || !key) {
      const urlLen = (url || '').length;
      const keyLen = (key || '').length;
      console.log(`SKIP e2e: N8N_API_URL or N8N_API_KEY not set (urlLen=${urlLen}, keyLen=${keyLen})`);
      console.log('Hint: set N8N_API_URL and N8N_API_KEY in .env at package root.');
      process.exit(0);
      return;
    }
    // Normalize into primary env names for child processes
    process.env.N8N_API_URL = url;
    process.env.N8N_API_KEY = key;
    await generateTools();
    // Call tools/list to ensure registry loads
    const list = await runNode(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-n8n-server.js'), '--once', 'tools/list', '{}'], {
      N8N_API_URL: url,
      N8N_API_KEY: key
    });
    const names = JSON.parse(list.out).tools.map((t) => t.name);
    // Prefer generated workflow list tool, fallback to built-in list
    const toolName = names.find((n) => /Workflow\.get__workflows$/.test(n)) || 'n8n.workflows.list';
    const res = await mcpCall(toolName, {}, { N8N_API_URL: url, N8N_API_KEY: key });
    // tools/call returns { content: [ { type: 'json', json: ... } ] }
    if (!res || !Array.isArray(res.content) || !res.content[0] || res.content[0].type !== 'json') {
      throw new Error('Unexpected tools/call response shape');
    }
    const payload = res.content[0].json;
    if (!payload || (typeof payload !== 'object')) throw new Error('Missing JSON payload');
    // Accept either { data: [...] } or [ ... ]
    const items = Array.isArray(payload) ? payload : payload.data;
    if (!Array.isArray(items)) throw new Error('Expected array of workflows');
    console.log(`OK: received ${items.length} workflows`);
    process.exit(0);
  } catch (err) {
    console.error('E2E FAILED:', err.message);
    process.exit(1);
  }
})();
