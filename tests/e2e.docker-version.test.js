// E2E-ish test for docker.engine.version via dedicated Docker MCP server.
// Skips unless DOCKER_API_HOST is set or DOCKER_SOCK exists and is readable.
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function shouldRun() {
  const api = process.env.DOCKER_API_HOST;
  if (api && api.length > 0) return true;
  const sock = process.env.DOCKER_SOCK || '/var/run/docker.sock';
  try { return fs.existsSync(sock); } catch (_) { return false; }
}

function runCall(name, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-docker-server.js')], {
      env: { ...process.env, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe']
    });
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
    setTimeout(() => finish(() => reject(new Error(`Timeout waiting for response. Stderr: ${err}`))), 15000);
    const req = { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name, arguments: args || {} } };
    child.stdin.write(JSON.stringify(req) + '\n');
    child.stdin.end();
  });
}

(async () => {
  try {
    if (!shouldRun()) {
      console.log('SKIP docker e2e: no DOCKER_API_HOST and no DOCKER_SOCK present');
      process.exit(0);
      return;
    }
    const res = await runCall('docker.engine.version', {});
    if (!res || typeof res !== 'object') throw new Error('docker.engine.version returned no object');
    console.log('Docker engine version OK');
    process.exit(0);
  } catch (err) {
    console.error('DOCKER E2E FAILED:', err.message);
    process.exit(1);
  }
})();

