const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const { generateMcpTools } = require('../lib/openapi-generator');

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

(async () => {
  // Minimal OpenAPI 3.0 spec
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    servers: [{ url: 'http://example.com/api/v1' }],
    paths: {
      '/widgets/{id}': {
        get: {
          operationId: 'getWidget',
          summary: 'Get widget',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'expand', in: 'query', required: false, schema: { type: 'string' } }
          ]
        }
      }
    }
  };

  // 1) Direct generator invocation
  const tools = await generateMcpTools(spec, { baseUrl: 'http://example.com/api/v1' });
  assert(Array.isArray(tools) && tools.length > 0, 'generateMcpTools should return tools');
  const t = tools[0];
  assert(t.name && t.description, 'tool has name and description');
  assert(t.inputSchema && typeof t.inputSchema === 'object', 'tool has inputSchema');
  assert(t.method && t.pathTemplate, 'tool includes method and pathTemplate metadata');

  // 2) Offline JSON generation via CLI and validation of shape
  const tmpDir = path.resolve(__dirname, 'tmp');
  const specPath = path.join(tmpDir, 'simple-openapi.json');
  writeJson(specPath, spec);
  const outPath = path.join(tmpDir, 'offline-tools.json');
  const genRes = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'examples', 'generate-openapi-mcp-tools.js'), '--from-file', specPath, '--out', outPath], { stdio: 'inherit', env: process.env });
  assert.strictEqual(genRes.status, 0, 'generator CLI should exit 0');
  const offline = readJson(outPath);
  assert(offline && Array.isArray(offline.tools) && offline.tools.length > 0, 'offline tools JSON present');
  const offTool = offline.tools[0];
  assert(offTool.name && offTool.method && offTool.pathTemplate, 'offline tool has required fields');
  assert(offTool.inputSchema && typeof offTool.inputSchema === 'object', 'offline tool has inputSchema');

  console.log('Smoke test passed: generator + offline JSON shape');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
