const patterns = (process.env.OPENAPI_MCP_ALLOWED_PATHS || '').split(',').filter(p => p.trim());
console.log('Raw patterns:', patterns);

function wildcardToRegExp(pattern) {
  console.log('Processing pattern:', pattern);
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, function(match) {
    console.log('Escaping:', match, '->', '\\' + match);
    return '\\' + match;
  }).replace(/\*/g, '.*');
  console.log('Escaped pattern:', esc);
  const regex = new RegExp('^' + esc + '$');
  console.log('Final regex:', regex);
  return regex;
}

const regexes = patterns.map(wildcardToRegExp);
console.log('All regexes:', regexes);
console.log('Test /union-any:', regexes.some(r => r.test('/union-any')));