import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { generateMcpTools } = await import('../../lib/openapi-generator/index.js');

(async () => {
  try {
    const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'tmp', 'auth-schemes-openapi.json'), 'utf8'));
    const tools = await generateMcpTools(spec, { baseUrl: 'http://localhost:3999' });

    const byName = Object.fromEntries(tools.map(t => [t.name, t]));

    // apiKey
    const tApi = byName['pingApiKey'];
    assert(tApi, 'pingApiKey tool missing');
    const secApi = tApi.serializationInfo.security.find(s => s.type === 'apiKey');
    assert(secApi && secApi.in === 'header' && secApi.name === 'api_key', 'apiKey security base shape wrong');
    assert(secApi.paramName === 'X-API-Key', 'apiKey paramName should be header name');
    assert(tApi.inputSchema.properties['X-API-Key'], 'inputSchema should include X-API-Key');

    // bearer
    const tBearer = byName['pingBearer'];
    assert(tBearer, 'pingBearer tool missing');
    const secBearer = tBearer.serializationInfo.security.find(s => s.type === 'http' && s.scheme === 'bearer');
    assert(secBearer, 'bearer security not present');
    assert(tBearer.inputSchema.properties.bearerToken, 'bearerToken should be in inputSchema');

    // basic
    const tBasic = byName['pingBasic'];
    assert(tBasic, 'pingBasic tool missing');
    const secBasic = tBasic.serializationInfo.security.find(s => s.type === 'http' && s.scheme === 'basic');
    assert(secBasic, 'basic security not present');
    assert(tBasic.inputSchema.properties.username && tBasic.inputSchema.properties.password, 'basic auth username/password should be in inputSchema');

    console.log('OK: apiKey/bearer/basic serialization verified');
    process.exit(0);
  } catch (err) {
    console.error('UNIT FAILED:', err.message);
    process.exit(1);
  }
})();
