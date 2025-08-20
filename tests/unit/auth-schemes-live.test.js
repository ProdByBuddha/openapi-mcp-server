const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const { generateMcpTools } = require('../../lib/openapi-generator');

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  let srv;
  try {
    // Start local auth server
    srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'tmp', 'auth-server.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    await wait(500);

    // Load spec and generate tools with baseUrl pointing to local server
    const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'tmp', 'auth-schemes-openapi.json'), 'utf8'));
    const tools = await generateMcpTools(spec, { baseUrl: 'http://localhost:3999' });
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));

    // apiKey live call
    const tApi = byName['pingApiKey'];
    assert(tApi, 'pingApiKey tool missing');
    const resApi = await tApi.handler({ ['X-API-Key']: 'k' });
    assert(resApi && resApi.ok === true && resApi.scheme === 'apiKey', 'apiKey live call failed');

    // bearer live call
    const tBearer = byName['pingBearer'];
    assert(tBearer, 'pingBearer tool missing');
    const resBearer = await tBearer.handler({ bearerToken: 'token' });
    assert(resBearer && resBearer.ok === true && resBearer.scheme === 'bearer', 'bearer live call failed');

    // basic live call
    const tBasic = byName['pingBasic'];
    assert(tBasic, 'pingBasic tool missing');
    const resBasic = await tBasic.handler({ username: 'u', password: 'p' });
    assert(resBasic && resBasic.ok === true && resBasic.scheme === 'basic', 'basic live call failed');

    console.log('OK: live auth server calls succeeded (apiKey, bearer, basic)');
    process.exit(0);
  } catch (err) {
    console.error('UNIT FAILED:', err.message);
    process.exit(1);
  } finally {
    try { if (srv) srv.kill(); } catch (_) {}
  }
})();

