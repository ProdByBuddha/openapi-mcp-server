import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runOnce(method, params) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-docker-server.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let done = false;
    const finish = (fn) => { if (done) return; done = true; try { fn(); } finally { try { child.kill(); } catch {} } };
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
    setTimeout(() => finish(() => reject(new Error(`Timeout: ${err}`))), 15000);
    const req = { jsonrpc: '2.0', id: '1', method: 'tools/list', params: {} };
    child.stdin.write(JSON.stringify(req) + "\n");
    child.stdin.end();
  });
}

(async () => {
  try {
    // Just ensure server loads and returns tools; do not require Docker runtime.
    const res = await runOnce('tools/list', {});
    if (!res || !Array.isArray(res.tools)) throw new Error('No tools returned by docker server');
    console.log('Docker server tools/list OK');
    process.exit(0);
  } catch (err) {
    console.error('SMOKE DOCKER FAILED:', err.message);
    process.exit(1);
  }
})();
