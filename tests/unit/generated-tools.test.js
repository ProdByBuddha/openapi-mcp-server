import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function once(method, params){ const p = spawnSync(process.execPath,[path.resolve(__dirname,'..','..','examples','mcp-n8n-server.js'),'--once',method,JSON.stringify(params||{})],{encoding:'utf8',env:{...process.env,N8N_MCP_DRY_RUN:'1'}}); if(p.status!==0) throw new Error('Call failed:'+p.stderr); return JSON.parse(p.stdout); }
function buildArgs(schema){ const args={}; if(!schema||typeof schema!=="object") return args; const req = Array.isArray(schema.required)?schema.required:[]; const props = schema.properties||{}; for(const k of req){ const p=props[k]||{}; const t=Array.isArray(p.type)?p.type[0]:p.type; if(t==='number'||t==='integer') args[k]=1; else if(t==='boolean') args[k]=true; else if(t==='object') args[k]={}; else if(t==='array') args[k]=[]; else args[k]='id'; } return args; }
(async()=>{ try {
  const listed = once('tools/list', {}); const tools = listed.tools||[]; if(!Array.isArray(tools)) throw new Error('tools/list returned invalid');
  let ok=0; for(const t of tools){ try{ const args = buildArgs(t.inputSchema); const res = once(t.name, args); if(!res||typeof res!=='object') throw new Error('no result'); ok++; } catch(e){ const msg=String(e.message||''); if(/Path not allowed|Method not allowed|Rate limit/i.test(msg)){ /* skip due to policy */ } else { throw new Error('tool failed: '+t.name+': '+e.message); } } }
  console.log('Dry-run OK for tools:', String(ok));
  process.exit(0);
} catch (e) { console.error('UNIT FAILED:', e.message); process.exit(1);} })();