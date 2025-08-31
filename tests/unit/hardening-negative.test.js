import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { generateMcpServer } = await import('../../lib/openapi-generator/server-generator.js');

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  let srv;
  try {
    // Start local server
    srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'tmp', 'union-server.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    await wait(400);

    const specPath = path.resolve(__dirname, '..', 'tmp', 'union-openapi.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const outDir = path.resolve(__dirname, '..', 'tmp', 'generated-hardening');
    fs.rmSync(outDir, { recursive: true, force: true });
    await generateMcpServer(spec, outDir, { baseUrl: 'http://localhost:4556' });
    execSync('npm install', { cwd: outDir, stdio: 'inherit' });
    const toolsPath = path.join(outDir, 'tools.js');

    // Helper to load tools with fresh policy env
    const loadToolsWithEnv = async (env) => {
      for (const k of ['OPENAPI_MCP_ALLOWED_PATHS','OPENAPI_MCP_ALLOWED_METHODS','OPENAPI_MCP_RATE_LIMIT','OPENAPI_MCP_RATE_WINDOW_MS']) {
        if (env[k] !== undefined) process.env[k] = env[k]; else delete process.env[k];
      }
      // For ES modules, we need to use dynamic import with a cache-busting query
      const toolsModule = await import(`${toolsPath}?t=${Date.now()}`);
      const tools = toolsModule.tools;
      return Object.fromEntries(tools.map((t) => [t.name, t]));
    };

    // 1) Path allowlist blocks call
    let tools = await loadToolsWithEnv({ OPENAPI_MCP_ALLOWED_PATHS: '/not-allowed*', OPENAPI_MCP_ALLOWED_METHODS: 'GET,POST' });
    let threw = false;
    try {
      await tools['testUnionAny'].handler({ body: { a: 'ok' } });
    } catch (e) { threw = /Path not allowed/i.test(String(e.message||'')); }
    assert(threw, 'Expected Path not allowed to be thrown');

    // 2) Method allowlist blocks POST
    tools = await loadToolsWithEnv({ OPENAPI_MCP_ALLOWED_PATHS: '/union-*', OPENAPI_MCP_ALLOWED_METHODS: 'GET' });
    threw = false;
    let errorMsg = '';
    try {
      await tools['testUnionAny'].handler({ body: { a: 'ok' } });
    } catch (e) { 
      errorMsg = String(e.message || '');
      threw = /Method not allowed/i.test(errorMsg); 
    }
    if (!threw) {
      console.log('DEBUG: Expected Method not allowed error, but got:', errorMsg);
      console.log('DEBUG: OPENAPI_MCP_ALLOWED_METHODS =', process.env.OPENAPI_MCP_ALLOWED_METHODS);
    }
    assert(threw, 'Expected Method not allowed to be thrown');

    // 3) Rate limit exceeded on second call
    tools = await loadToolsWithEnv({ OPENAPI_MCP_ALLOWED_PATHS: '/union-*', OPENAPI_MCP_ALLOWED_METHODS: 'GET,POST', OPENAPI_MCP_RATE_LIMIT: '1', OPENAPI_MCP_RATE_WINDOW_MS: '60000' });
    const ok1 = await tools['testUnionAny'].handler({ body: { a: 'ok' } });
    assert(ok1 && ok1.ok === true, 'First call should succeed');
    threw = false;
    try { await tools['testUnionAny'].handler({ body: { a: 'again' } }); } catch (e) { threw = /Rate limit exceeded/i.test(String(e.message||'')); }
    assert(threw, 'Expected Rate limit exceeded on second call');

    console.log('OK: hardening negative cases (path/method/rate limit)');
    process.exit(0);
  } catch (err) {
    console.error('UNIT FAILED:', err.message);
    process.exit(1);
  } finally {
    try { if (srv) srv.kill(); } catch (_) {}
  }
})();

