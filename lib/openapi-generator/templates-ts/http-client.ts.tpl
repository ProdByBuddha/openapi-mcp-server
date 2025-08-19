import https from 'https';
import http from 'http';

export function makeHttpRequest(method: string, urlString: string, { headers, body, timeoutMs }: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlString); const lib = u.protocol === 'https:' ? https : http;
      const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const req = lib.request({ protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers, data ? { 'Content-Length': String(data.length) } : {}) }, (res) => {
        let resBody = ''; res.setEncoding('utf8'); res.on('data', (c) => resBody += c); res.on('end', () => resolve({ statusCode: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, body: resBody }));
      });
      req.on('error', reject); if (timeoutMs) req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out'))); if (data) req.write(data); req.end();
    } catch (e) { reject(e); }
  });
}
