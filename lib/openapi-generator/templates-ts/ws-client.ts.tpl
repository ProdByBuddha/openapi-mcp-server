import WebSocket from 'ws';

export interface McpRequest {
  jsonrpc: '2.0'; id: string | number; method: string; params?: any;
}
export interface McpResponse {
  jsonrpc?: '2.0'; id?: string | number; result?: any; error?: { code: number; message: string; data?: any };
}

export function connectWs(url: string) {
  const ws = new WebSocket(url);
  return {
    ws,
    call(method: string, params?: any): Promise<McpResponse> {
      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          const req: McpRequest = { jsonrpc: '2.0', id: '1', method, params };
          ws.send(JSON.stringify(req));
        });
        ws.on('message', (data) => {
          try { resolve(JSON.parse(String(data)) as McpResponse); }
          catch (e) { reject(e); }
          finally { try { ws.close(); } catch {} }
        });
        ws.on('error', reject);
      });
    }
  };
}
