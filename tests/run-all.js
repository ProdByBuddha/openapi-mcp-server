// Minimal test runner: executes all *.test.js in this folder sequentially
import fs from 'fs';
import path from 'path';
import { spawnSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dotenvx;
try { 
  const dotenvxModule = await import('@dotenvx/dotenvx');
  dotenvx = dotenvxModule.default || dotenvxModule;
} catch (_) { 
  try { 
    const dotenvModule = await import('dotenv');
    dotenvx = dotenvModule.default || dotenvModule;
  } catch (_) { 
    dotenvx = null; 
  }
}

const dir = __dirname;

// Load .env from likely locations if present and vars not already set
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || /^\s*#/.test(line)) continue;
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      // Strip trailing inline comments if unquoted
      if (!(val.startsWith('"') && val.endsWith('"')) && !(val.startsWith("'") && val.endsWith("'"))) {
        const hash = val.indexOf(' #');
        if (hash !== -1) val = val.slice(0, hash).trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    console.log(`Loaded env from ${filePath}`);
    return true;
  } catch (_) { return false; }
}

const envCandidates = [
  path.resolve(dir, '..', '.env'),                 // package .env
  path.resolve(dir, '..', '..', '.env'),          // repo root .env
  path.resolve(process.cwd(), '.env')             // current working dir
];
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    if (dotenvx) {
      const res = dotenvx.config({ path: p, override: false });
      if (!res.error) console.log(`dotenvx loaded: ${p}`);
    }
    loadEnvFile(p);
  }
}

// Ensure tools JSON exists; generate if env present
const toolsJson = path.resolve(__dirname, '..', 'examples', 'generated', 'n8n-openapi-tools.json');
if (!fs.existsSync(toolsJson) && process.env.N8N_API_URL && process.env.N8N_API_KEY) {
  console.log('Generating tools JSON...');
  const gen = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'examples', 'scripts', 'generate-openapi-mcp-tools.js'), '--from-url', String(process.env.N8N_API_URL).replace(/\$/, '') + '/docs/swagger-ui-init.js', '--out', toolsJson], { stdio: 'inherit', env: process.env });
  if (gen.status !== 0) process.exit(gen.status);
}

// Setup test servers dependencies
const tmpDir = path.resolve(__dirname, 'tmp');
if (fs.existsSync(tmpDir)) {
  const pkgJson = path.join(tmpDir, 'package.json');
  const pkg = { "name": "tmp-servers", "version": "1.0.0", "dependencies": { "express": "^4.17.1" } };
  fs.writeFileSync(pkgJson, JSON.stringify(pkg, null, 2));
  console.log('Installing test server dependencies in tests/tmp...');
  execSync('npm install', { cwd: tmpDir, stdio: 'inherit' });
}

// Generate unit tests from tools JSON (dry-run mode)
const genUnit = spawnSync(process.execPath, [path.resolve(__dirname, 'generate-unit-tests.js')], { stdio: 'inherit', env: process.env });
if (genUnit.status !== 0) process.exit(genUnit.status);

function collectTests(startDir) {
  const out = [];
  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    const p = path.join(startDir, entry.name);
    if (entry.isDirectory()) out.push(...collectTests(p));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const files = collectTests(dir).sort();

if (files.length === 0) {
  console.log('No tests found.');
  process.exit(0);
}

let failed = 0;
for (const f of files) {
  console.log(`\n>>> Running ${f}`);
  const res = spawnSync(process.execPath, [f], { stdio: 'inherit', env: process.env });
  if (res.status !== 0) failed++;
}

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
