const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const gen = require('../lib/openapi-generator');

(async () => {
  try {
    const spec = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'examples/specs/hostinger-api.json'), 'utf8'));
    const tools = await gen.generateMcpTools(spec, { baseUrl: (spec.servers && spec.servers[0] && spec.servers[0].url) || 'https://developers.hostinger.com' });
    assert(Array.isArray(tools) && tools.length > 0, 'Hostinger tools should be generated');
    console.log(`Hostinger generator OK: ${tools.length} tools`);
    // List via server --once tools/list
    const p = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'examples', 'mcp-hostinger-server.js'), '--once', 'tools/list', '{}'], { encoding: 'utf8', env: process.env });
    if (p.status !== 0) throw new Error(p.stderr || p.stdout);
    const listed = JSON.parse(p.stdout);
    assert(Array.isArray(listed.tools) && listed.tools.length > 0, 'Hostinger server tools/list should return tools');
    console.log('Hostinger server tools/list OK');
    process.exit(0);
  } catch (err) {
    console.error('SMOKE FAILED:', err.message);
    process.exit(1);
  }
})();
