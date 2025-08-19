const https = require('https');
const http = require('http');
const { URL } = require('url');
const DEBUG_HTTP = /^(1|true|yes)$/i.test(String(process.env.DEBUG_HTTP || ''));

function makeHttpRequest(method, urlString, { headers, body, timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const lib = url.protocol === 'https:' ? https : http;
      const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const defaultHeaders = { 'Content-Type': 'application/json' }; // Default Content-Type
      const requestHeaders = Object.assign({}, defaultHeaders, headers, data ? { 'Content-Length': String(data.length) } : {}); // Merge headers
      if (DEBUG_HTTP) console.log('Request Headers:', requestHeaders);
      const req = lib.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: requestHeaders
        },
        (res) => {
          let resBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (resBody += chunk));
          res.on('end', () => {
            const result = {
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              body: resBody
            };
            if (DEBUG_HTTP) console.log('Response:', { statusCode: res.statusCode, headers: res.headers });
            resolve(result);
          });
        }
      );
      req.on('error', reject);
      if (timeoutMs) req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out')));
      if (data) req.write(data);
      req.end();
    } catch (err) { reject(err); }
  });
}

module.exports = {
    makeHttpRequest
};
