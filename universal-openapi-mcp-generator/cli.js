#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { generateMcpTools } = require('./index');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spec') args.spec = argv[++i];
    else if (a === '--baseUrl') args.baseUrl = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--pretty') args.pretty = true;
    else if (a === '--security-template') args.securityTemplate = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  const help = `\nUniversal OpenAPI → MCP Generator CLI\n\nUsage:\n  universal-mcp-generator --spec <openapi.json> [--baseUrl <url>] [--out tools.json] [--pretty] [--security-template]\n\nOptions:\n  --spec <path>           Path to an OpenAPI 3.x JSON file\n  --baseUrl <url>         Override base URL (uses first server if omitted)\n  --out <path>            Write output JSON to file (default: stdout)\n  --pretty                Pretty-print JSON with 2-space indentation\n  --security-template     Print a securityHandlers template based on the spec\n  -h, --help              Show this help\n`;
  process.stdout.write(help);
}

function buildSecurityTemplate(spec) {
  const schemes = (spec.components && spec.components.securitySchemes) || {};
  const lines = [
    'const securityHandlers = {'
  ];
  for (const [name, def] of Object.entries(schemes)) {
    if (def.type === 'apiKey') {
      if (def.in === 'header') {
        lines.push(`  ${name}: (headers, query, args, schemeDef) => { if (args[schemeDef.name]) headers[schemeDef.name] = args[schemeDef.name]; },`);
      } else if (def.in === 'query') {
        lines.push(`  ${name}: (headers, query, args, schemeDef) => { if (args[schemeDef.name]) query[schemeDef.name] = args[schemeDef.name]; },`);
      } else if (def.in === 'cookie') {
        lines.push(`  ${name}: (headers, query, args, schemeDef) => { /* cookie is handled in the generator via Cookie header */ },`);
      }
    } else if (def.type === 'http' && def.scheme === 'bearer') {
      lines.push(`  ${name}: (headers, query, args) => { if (args.bearerToken) headers.Authorization = \`Bearer \${args.bearerToken}\`; },`);
    } else if (def.type === 'http' && def.scheme === 'basic') {
      lines.push(`  ${name}: (headers, query, args) => { if (args.username && args.password) { const t = Buffer.from(\`${'${args.username}:${args.password}'}\`).toString('base64'); headers.Authorization = \`Basic \${t}\`; } },`);
    } else {
      lines.push(`  ${name}: (headers, query, args, schemeDef) => { /* TODO: implement for type: ${def.type} */ },`);
    }
  }
  lines.push('};');
  return lines.join('\n');
}

async function runFromFile(opts) {
  if (!opts.spec) throw new Error('Missing --spec <path>');
  const specPath = path.resolve(process.cwd(), opts.spec);
  const raw = fs.readFileSync(specPath, 'utf8');
  const spec = JSON.parse(raw);

  if (opts.securityTemplate) {
    const tpl = buildSecurityTemplate(spec);
    return { type: 'template', content: tpl };
  }

  const tools = await generateMcpTools(spec, { baseUrl: opts.baseUrl });
  const out = opts.pretty ? JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })), null, 2)
                          : JSON.stringify(tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })));
  return { type: 'json', content: out };
}

async function run(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help || argv.length === 0) {
    printHelp();
    return 0;
  }
  try {
    const result = await runFromFile(opts);
    if (opts.out && result.type === 'json') {
      fs.writeFileSync(path.resolve(process.cwd(), opts.out), result.content, 'utf8');
    } else {
      process.stdout.write(result.content + '\n');
    }
    return 0;
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  run().then(code => process.exit(code));
}

module.exports = { parseArgs, buildSecurityTemplate, runFromFile };

