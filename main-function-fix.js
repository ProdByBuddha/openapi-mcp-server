async function main() {
  const args = parseArgs(process.argv.slice(2));
  const transports = (args.transport || 'stdio,http,sse,ws').toLowerCase().split(',');
  
  const transportPromises = [];
  
  if (transports.includes('http')) {
    transportPromises.push(new Promise((resolve, reject) => {
      try {
        const app = express();
        app.use(bodyParser.json());
        app.post('/mcp', async (req, res) => {
          try {
            const { method, params } = req.body || {};
            if (method === 'tools/list') return res.json(listToolsResponse());
            if (method === 'tools/call') {
              const result = await callToolByName(params?.name, params?.arguments || {});
              return res.json({ content: [{ type: 'json', json: result }] });
            }
            return res.status(400).json({ error: 'Unknown method' });
          } catch (e) { return res.status(500).json({ error: e.message }); }
        });
        const port = args.port || process.env.PORT || 3005;
        const server = app.listen(port, () => {
          console.log(`[multi-host] HTTP listening on ${port}`);
          resolve();
        });
        server.on('error', reject);
      } catch (e) {
        reject(e);
      }
    }));
  }

  if (transports.includes('sse')) {
    transportPromises.push(new Promise((resolve, reject) => {
      try {
        const app = express();
        app.use(bodyParser.json());
        app.get('/mcp-sse', (req, res) => {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
          send({ message: 'MCP SSE connection established.' });
        });
        const port = args.ssePort || process.env.SSE_PORT || 3006;
        const server = app.listen(port, () => {
          console.log(`[multi-host] SSE listening on ${port}`);
          resolve();
        });
        server.on('error', reject);
      } catch (e) {
        reject(e);
      }
    }));
  }

  if (transports.includes('ws') || transports.includes('websocket')) {
    if (!WebSocketServer) { 
      console.error('WS transport requested but ws is not installed'); 
      process.exit(1); 
    }
    transportPromises.push(new Promise((resolve, reject) => {
      try {
        const app = express();
        app.use(bodyParser.json());
        const port = args.wsPort || process.env.WS_PORT || 3007;
        const server = app.listen(port, () => {
          console.log(`[multi-host] WS listening on ${port}`);
          resolve();
        });
        server.on('error', reject);
        
        const wss = new WebSocketServer({ server, path: '/mcp' });
        wss.on('connection', (ws) => {
          ws.on('message', async (msg) => {
            try {
              const data = JSON.parse(String(msg));
              const { method, params } = data || {};
              if (method === 'tools/list') return ws.send(JSON.stringify(listToolsResponse()));
              if (method === 'tools/call') {
                const result = await callToolByName(params?.name, params?.arguments || {});
                return ws.send(JSON.stringify({ content: [{ type: 'json', json: result }] }));
              }
              ws.send(JSON.stringify({ error: 'Unknown method' }));
            } catch (e) { ws.send(JSON.stringify({ error: e.message })); }
          });
        });
      } catch (e) {
        reject(e);
      }
    }));
  }

  // Wait for all HTTP-based transports to start
  if (transportPromises.length > 0) {
    try {
      await Promise.all(transportPromises);
      console.log(`[multi-host] All HTTP transports started successfully`);
    } catch (e) {
      console.error(`[multi-host] Failed to start transports: ${e.message}`);
      process.exit(1);
    }
  }

  if (transports.includes('stdio')) {
    console.log(`[multi-host] Starting STDIO transport`);
    // stdio loop
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
      buffer += chunk; let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim(); buffer = buffer.slice(idx + 1);
        if (!line) continue; let msg; try { msg = JSON.parse(line); } catch (_) { writeResponse(null, null, { code: -32700, message: 'Parse error' }); continue; }
        const { id, method, params } = msg || {};
        if (method === 'initialize') { writeResponse(id, { protocolVersion: '2024-11-05', serverInfo: { name: 'mcp-multi-host', version: '1.3.2' }, capabilities: { tools: {} } }); continue; }
        if (method === 'tools/list') { writeResponse(id, listToolsResponse()); continue; }
        if (method === 'tools/call') {
          try { const result = await callToolByName(params?.name, params?.arguments || {}); writeResponse(id, { content: [{ type: 'json', json: result }] }); }
          catch (err) { writeResponse(id, null, toRpcError(err)); }
          continue;
        }
        writeResponse(id, null, { code: -32601, message: `Unknown method: ${method}` });
      }
    });
  }
}
