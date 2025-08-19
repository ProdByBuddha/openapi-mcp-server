const express = require('express');
const bodyParser = require('body-parser');
const { tools } = require('./tools.js');
let WebSocketServer;
try { WebSocketServer = require('ws').WebSocketServer; } catch (_) { WebSocketServer = null; }

const toolMap = new Map(tools.map(t => [t.name, t]));

async function handleMcpRequest(req) {
  const { tool, inputs } = req;

  if (!toolMap.has(tool)) {
    throw new Error(`Tool '${tool}' not found.`);
  }

  const handler = toolMap.get(tool).handler;
  return await handler(inputs);
}

function runHttpServer() {
  const app = express();
  app.use(bodyParser.json());

  app.post('/mcp', async (req, res) => {
    try {
      const result = await handleMcpRequest(req.body);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`MCP server listening on port ${port}`);
  });
}

function runStdioServer() {
  process.stdin.on('data', async (data) => {
    try {
      const req = JSON.parse(data.toString());
      const result = await handleMcpRequest(req);
      process.stdout.write(JSON.stringify({ result }) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify({ error: error.message }) + '\n');
    }
  });
}

function runSseServer() {
  const app = express();
  app.use(bodyParser.json());

  app.get('/mcp-sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    req.on('close', () => {
      // Clean up resources if needed
    });

    // Example of sending a welcome message
    sendEvent({ message: 'MCP SSE connection established.' });

    // In a real implementation, you would listen for incoming MCP requests
    // from the client, for example, via another endpoint or a message queue.
    // For this example, we'll just send a dummy response every 10 seconds.
    const interval = setInterval(() => {
      sendEvent({ message: 'ping' });
    }, 10000);

    res.on('close', () => {
      clearInterval(interval);
    });
  });

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`MCP SSE server listening on port ${port}`);
  });
}

function runWebSocketServer() {
  if (!WebSocketServer) {
    console.error('WebSocket transport requested but "ws" is not installed.');
    process.exit(1);
  }
  const app = express();
  app.use(bodyParser.json());
  const server = app.listen(process.env.PORT || 3001, () => {
    console.log(`MCP WS server listening on port ${server.address().port}`);
  });
  const wss = new WebSocketServer({ server, path: '/mcp' });
  wss.on('connection', (ws) => {
    ws.on('message', async (msg) => {
      try {
        const req = JSON.parse(String(msg));
        const result = await handleMcpRequest(req);
        ws.send(JSON.stringify({ result }));
      } catch (err) {
        ws.send(JSON.stringify({ error: err.message }));
      }
    });
  });
}


function main() {
  const args = process.argv.slice(2);
  const transport = args[0] === '--transport' ? args[1] : 'http';

  if (transport === 'http') {
    runHttpServer();
  } else if (transport === 'stdio') {
    runStdioServer();
  } else if (transport === 'sse') {
    runSseServer();
  } else if (transport === 'ws' || transport === 'websocket') {
    runWebSocketServer();
  } else {
    console.error(`Unknown transport: ${transport}`);
    process.exit(1);
  }
}

main();
