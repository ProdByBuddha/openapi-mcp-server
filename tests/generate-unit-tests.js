// Auto-generate a unit test that dry-runs each available tool listed by the server
// using inputSchema to synthesize minimal required arguments. This keeps tests
// stable regardless of how tools are provided (built-ins vs. offline JSON vs. dynamic).
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, 'unit');
const outFile = path.join(outDir, 'generated-tools.test.js');

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const lines = [];
  lines.push("const { spawnSync } = require('child_process');");
  lines.push("const path = require('path');");
  lines.push("function once(method, params){ const p = spawnSync(process.execPath,[path.resolve(__dirname,'..','..','examples','mcp-n8n-server.js'),'--once',method,JSON.stringify(params||{})],{encoding:'utf8',env:{...process.env,N8N_MCP_DRY_RUN:'1'}}); if(p.status!==0) throw new Error('Call failed:'+p.stderr); return JSON.parse(p.stdout); }");
  lines.push("function buildArgs(schema){ const args={}; if(!schema||typeof schema!==\"object\") return args; const req = Array.isArray(schema.required)?schema.required:[]; const props = schema.properties||{}; for(const k of req){ const p=props[k]||{}; const t=Array.isArray(p.type)?p.type[0]:p.type; if(t==='number'||t==='integer') args[k]=1; else if(t==='boolean') args[k]=true; else if(t==='object') args[k]={}; else if(t==='array') args[k]=[]; else args[k]='id'; } return args; }");
  lines.push("(async()=>{ try {");
  lines.push("  const listed = once('tools/list', {}); const tools = listed.tools||[]; if(!Array.isArray(tools)) throw new Error('tools/list returned invalid');");
  lines.push("  let ok=0; for(const t of tools){ try{ const args = buildArgs(t.inputSchema); const res = once(t.name, args); if(!res||typeof res!=='object') throw new Error('no result'); ok++; } catch(e){ const msg=String(e.message||''); if(/Path not allowed|Method not allowed|Rate limit/i.test(msg)){ /* skip due to policy */ } else { throw new Error('tool failed: '+t.name+': '+e.message); } } }");
  lines.push("  console.log('Dry-run OK for tools:', String(ok));");
  lines.push("  process.exit(0);");
  lines.push("} catch (e) { console.error('UNIT FAILED:', e.message); process.exit(1);} })();");
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(`Wrote ${outFile}.`);
}

main();
