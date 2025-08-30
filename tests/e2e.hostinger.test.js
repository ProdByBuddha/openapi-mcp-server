// E2E for Hostinger MCP (skips without HOSTINGER_API_TOKEN)
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(msg) { process.stdout.write(msg + '\n'); }

function runOnce(method, params, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-hostinger-server.js')], {
      env: { ...process.env, ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    let resolved = false;
    const finish = (fn) => { if (resolved) return; resolved = true; try { fn(); } finally { try { child.kill(); } catch (_) {} } };
    child.stdout.on('data', (d) => {
      out += d.toString();
      const lines = out.split(/\n+/).filter(Boolean);
      try {
        for (const line of lines) {
          const msg = JSON.parse(line);
          if (msg && (msg.result || msg.error)) {
            if (msg.error) return finish(() => reject(new Error(`MCP error: ${JSON.stringify(msg.error)}`)));
            return finish(() => resolve(msg.result));
          }
        }
      } catch (_) {}
    });
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => finish(() => reject(e)));
    const t = setTimeout(() => finish(() => reject(new Error(`Timed out waiting for MCP response. Stderr: ${err}`))), 20000);
    const req = { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name: method, arguments: params || {} } };
    child.stdin.write(JSON.stringify(req) + '\n');
    child.stdin.end();
  });
}

(async () => {
  try {
    const token = process.env.HOSTINGER_API_TOKEN;
    if (!token) {
      log('SKIP hostinger e2e: HOSTINGER_API_TOKEN not set');
      process.exit(0);
      return;
    }
    // Try a read-only endpoint: catalog list
    const res = await runOnce('billing_getCatalogItemListV1', {}, { HOSTINGER_API_TOKEN: token });
    if (!res) throw new Error('Empty response from Hostinger catalog list');
    log('Hostinger e2e OK: catalog list responded');
    process.exit(0);
  } catch (err) {
    console.error('HOSTINGER E2E FAILED:', err.message);
    process.exit(1);
  }
})();

