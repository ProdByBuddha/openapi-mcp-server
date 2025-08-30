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
    // Start local union test server
    srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'tmp', 'union-server.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    await wait(400);

    // Load union spec and generate a temp server using templates
    const specPath = path.resolve(__dirname, '..', 'tmp', 'union-openapi.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const outDir = path.resolve(__dirname, '..', 'tmp', 'generated-union');
    fs.rmSync(outDir, { recursive: true, force: true });
    await generateMcpServer(spec, outDir, { baseUrl: 'http://localhost:4556' });
    execSync('npm install', { cwd: outDir, stdio: 'inherit' });

    // Ensure generated server policy allows our test routes
    process.env.OPENAPI_MCP_ALLOWED_PATHS = '/union-*';
    process.env.OPENAPI_MCP_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE';
    process.env.DEBUG_HTTP = '1';
    const toolsModule = await import(path.join(outDir, 'tools.js'));
    const tools = toolsModule.tools;
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    // anyOf: valid input (a: string)
    const resAny = await byName['testUnionAny'].handler({ body: { a: 'hello' } });
    assert(resAny && resAny.ok === true && resAny.type === 'any', 'anyOf valid case failed');

    // anyOf: invalid input (a: number) — should fail validation before HTTP call
    let threw = false;
    try {
      await byName['testUnionAny'].handler({ body: { a: 123 } });
    } catch (e) {
      threw = /Invalid input/i.test(String(e.message || ''));
    }
    assert(threw, 'anyOf invalid case did not fail validation');

    // oneOf: valid input (y: integer)
    const resOne = await byName['testUnionOne'].handler({ body: { y: 42 } });
    assert(resOne && resOne.ok === true && resOne.type === 'one', 'oneOf valid case failed');

    // oneOf: invalid input (y: string)
    threw = false;
    try {
      await byName['testUnionOne'].handler({ body: { y: 'nope' } });
    } catch (e) {
      threw = /Invalid input/i.test(String(e.message || ''));
    }
    assert(threw, 'oneOf invalid case did not fail validation');

    // nested unions: valid cases
    const resNested1 = await byName['testUnionNested'].handler({ body: { inner: 's' } });
    assert(resNested1 && resNested1.ok && resNested1.type === 'nested');
    const resNested2 = await byName['testUnionNested'].handler({ body: { flag: true } });
    assert(resNested2 && resNested2.ok && resNested2.type === 'nested');
    // nested unions: invalid
    let bad = false;
    try { await byName['testUnionNested'].handler({ body: { inner: true } }); } catch (e) { bad = /Invalid input/i.test(String(e.message||'')); }
    assert(bad, 'nested union invalid case did not fail');

    // array of unions: valid
    const resArr = await byName['testUnionArray'].handler({ body: ['a', 2, 'b'] });
    assert(resArr && resArr.ok && resArr.type === 'array');
    // array of unions: invalid
    bad = false;
    try { await byName['testUnionArray'].handler({ body: ['a', { nope: true }] }); } catch (e) { bad = /Invalid input/i.test(String(e.message||'')); }
    assert(bad, 'array union invalid case did not fail');

    console.log('OK: Zod union validation (anyOf/oneOf/nested/array) works');
    process.exit(0);
  } catch (err) {
    console.error('UNIT FAILED:', err.message);
    process.exit(1);
  } finally {
    try { if (srv) srv.kill(); } catch (_) {}
  }
})();
