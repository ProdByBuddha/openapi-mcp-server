const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { generateMcpTools } = require('../../lib/openapi-generator');

(async () => {
  try {
    const specPath = path.resolve(__dirname, '..', 'tmp', 'oauth2-openapi.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const tools = await generateMcpTools(spec, { baseUrl: 'http://localhost:3002' });
    const tool = tools.find(t => t.name === 'getWidgets');
    assert(tool, 'Expected getWidgets tool to be generated');
    assert(tool.serializationInfo && Array.isArray(tool.serializationInfo.security), 'serializationInfo.security missing');
    const sec = tool.serializationInfo.security.find(s => s.type === 'oauth2');
    assert(sec, 'oauth2 security not present');
    assert(sec.flows && sec.flows.clientCredentials && typeof sec.flows.clientCredentials.tokenUrl === 'string', 'oauth2 clientCredentials tokenUrl missing');
    assert.strictEqual(sec.flows.clientCredentials.tokenUrl, 'http://localhost:3002/token', 'unexpected tokenUrl');
    console.log('OK: OAuth2 serialization includes clientCredentials tokenUrl');
    process.exit(0);
  } catch (err) {
    console.error('UNIT FAILED:', err.message);
    process.exit(1);
  }
})();

