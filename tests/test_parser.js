import fs from 'fs';
import path from 'path';
import { generateMcpTools } from '../lib/openapi-generator/index.js';

async function test() {
  try {
    const specPath = path.resolve(__dirname, 'specs/n8n-api.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    console.log('Successfully parsed specs/n8n-api.json');

    const secHandlers = { available: true, '*': () => {} };
    const securityHandlers = new Proxy(secHandlers, { get: (t, p) => t[p] || t['*'] || undefined });

    const tools = await generateMcpTools(spec, { securityHandlers });
    console.log('Successfully generated tools');
    console.log(tools.length);
  } catch (err) {
    console.error(err);
  }
}

test();
