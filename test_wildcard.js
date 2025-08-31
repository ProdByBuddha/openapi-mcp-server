function wildcardToRegExp(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, function(match) {
    return '\\' + match;
  }).replace(/\*/g, '.*');
  return new RegExp('^' + esc + '$');
}

const patterns = (process.env.OPENAPI_MCP_ALLOWED_PATHS || '').split(',').filter(p => p.trim());
console.log('Patterns:', patterns);
const regexes = patterns.map(wildcardToRegExp);
console.log('Regexes:', regexes);
console.log('Test /union-any:', regexes.some(r => r.test('/union-any')));