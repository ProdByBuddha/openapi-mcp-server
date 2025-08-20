/*
 * Build a TOOLS.md from generated MCP tools JSON
 * Usage: node examples/build-tools-readme.js [pathToJson] [outPath]
 * Defaults: examples/generated/n8n-openapi-tools.json -> examples/generated/TOOLS.md
 */

const fs = require('fs');
const path = require('path');

function loadTools(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.tools) ? data.tools : [];
}

function groupByTag(tools) {
  const groups = new Map();
  for (const t of tools) {
    const name = t.name || '';
    const parts = String(name).split('.');
    // Expect: n8n.vX.Tag.operation
    const tag = parts.length >= 3 ? parts[2] : 'api';
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(t);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  return groups;
}

function buildMarkdown(tools) {
  const total = tools.length;
  const groups = groupByTag(tools);
  const lines = [];
  lines.push('# n8n MCP Tools');
  lines.push('');
  lines.push(`Total tools: ${total}`);
  lines.push('');
  const tagNames = Array.from(groups.keys()).sort();
  for (const tag of tagNames) {
    lines.push(`## ${tag}`);
    const list = groups.get(tag);
    for (const t of list) {
      const desc = t.description ? ` — ${t.description}` : '';
      lines.push(`- ${t.name}${desc}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const jsonPath = process.argv[2] || path.resolve(__dirname, 'generated', 'n8n-openapi-tools.json');
  const outPath = process.argv[3] || path.resolve(__dirname, 'generated', 'TOOLS.md');
  const tools = loadTools(jsonPath);
  const md = buildMarkdown(tools);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`Wrote ${outPath} (${tools.length} tools)`);
}

main();

