import express from 'express';
import bodyParser from 'body-parser';
import { tools } from './tools';
import { WebSocketServer } from 'ws';

const toolMap = new Map(tools.map(t => [t.name, t]));

async function handleMcpRequest(req: any) {
  const { tool, inputs } = req;
  if (!toolMap.has(tool)) throw new Error(`Tool '${tool}' not found.`);
  const handler = (toolMap.get(tool) as any).handler;
  return await handler(inputs);
}

function runHttpServer() {
  const app = express();
  app.use(bodyParser.json());
  app.post('/mcp', async (req, res) => {
    try { const result = await handleMcpRequest(req.body); res.json({ result }); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  const port = process.env.PORT || 3001;
  app.listen(port, () => { console.log(`MCP server listening on port ${port}`); });
}

function runStdioServer() {
  process.stdin.on('data', async (data) => {
    try { const req = JSON.parse(data.toString()); const result = await handleMcpRequest(req); process.stdout.write(JSON.stringify({ result }) + '
'); }
    catch (error: any) { process.stdout.write(JSON.stringify({ error: error.message }) + '
'); }
  });
}

function main() {
  const args = process.argv.slice(2);
  const transport = args[0] === '--transport' ? args[1] : 'http';
  if (transport === 'http') runHttpServer();
  else if (transport === 'stdio') runStdioServer();
  else { console.error(`Unknown transport: ${transport}`); process.exit(1); }
}


function runSseServer() {
  const app = express();
  app.use(bodyParser.json());
  app.get('/mcp-sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = (data: any) => res.write(`data: ${JSON.stringify(data)}

`);
    send({ message: 'MCP SSE connection established.' });
  });
  const port = process.env.PORT || 3001; (app as any).listen(port, () => console.log(`MCP SSE server listening on ${port}`));
}

function runWebSocketServer() {
  const app = express();
  app.use(bodyParser.json());
  const server = (app as any).listen(process.env.PORT || 3001, () => console.log(`MCP WS server listening`));
  const wss = new WebSocketServer({ server, path: '/mcp' });
  wss.on('connection', (ws) => {
    (ws as any).on('message', async (msg: any) => {
      try { const req = JSON.parse(String(msg)); const result = await handleMcpRequest(req); (ws as any).send(JSON.stringify({ result })); }
      catch (err: any) { (ws as any).send(JSON.stringify({ error: err.message })); }
    });
  });
}

function main() {
  const args = process.argv.slice(2);
  const transport = args[0] === '--transport' ? args[1] : 'http';
  if (transport === 'http') runHttpServer();
  else if (transport === 'stdio') runStdioServer();
  else if (transport === 'sse') runSseServer();
  else if (transport === 'ws' || transport === 'websocket') runWebSocketServer();
  else { console.error(`Unknown transport: ${transport}`); process.exit(1); }
}

main();

