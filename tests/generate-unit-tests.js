// Auto-generate a unit test that dry-runs each generated tool
const fs = require('fs');
const path = require('path');

const toolsJson = path.resolve(__dirname, '..', 'examples', 'generated', 'n8n-openapi-tools.json');
const outDir = path.resolve(__dirname, 'unit');
const outFile = path.join(outDir, 'generated-tools.test.js');

function sanitizeArgName(name) {
  return String(name).replace(/[^A-Za-z0-9_]/g, '');
}

function buildArgsForTool(t) {
  const args = {};
  // infer path params from {param}
  const m = String(t.pathTemplate || '').match(/\{[^}]+\}/g);
  if (m) {
    for (const seg of m) {
      const key = seg.slice(1, -1);
      args[key] = sanitizeArgName(key) || 'id';
    }
  }
  // no query/body for dry-run
  return args;
}

function main() {
  if (!fs.existsSync(toolsJson)) {
    console.log('No tools JSON found; skipping unit test generation.');
    process.exit(0);
  }
  const gen = JSON.parse(fs.readFileSync(toolsJson, 'utf8'));
  const tools = Array.isArray(gen.tools) ? gen.tools : [];
  fs.mkdirSync(outDir, { recursive: true });
  const lines = [];
  lines.push("const { spawnSync } = require('child_process');");
  lines.push("const path = require('path');");
  lines.push("function call(name,args){ const p = spawnSync(process.execPath,[path.resolve(__dirname,'..','..','examples','mcp-n8n-server.js'),'--once',name,JSON.stringify(args||{})],{encoding:'utf8',env:{...process.env,N8N_MCP_DRY_RUN:'1'}}); if(p.status!==0) throw new Error('Call failed:'+p.stderr); return JSON.parse(p.stdout); }");
  lines.push("(async()=>{ try {");
  let count = 0;
  for (const t of tools) {
    const args = buildArgsForTool(t);
    const argsStr = JSON.stringify(args);
    // Use try/catch per tool to continue on non-critical failures
    lines.push(`  try { const res = call(${JSON.stringify(t.name)}, ${argsStr}); if (!res || typeof res !== 'object') throw new Error('no result'); if (!('dryRun' in res)) throw new Error('not dry-run'); } catch(e){ throw new Error('tool failed: ${t.name}: '+e.message); }`);
    count++;
  }
  lines.push("  console.log('Dry-run OK for tools:', '" + count + "');");
  lines.push("  process.exit(0);");
  lines.push("} catch (e) { console.error('UNIT FAILED:', e.message); process.exit(1);} })();");
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(`Wrote ${outFile} for ${count} tools.`);
}

main();
