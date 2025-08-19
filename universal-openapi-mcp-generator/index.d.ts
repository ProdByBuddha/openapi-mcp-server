export interface SecurityHandler {
  (headers: Record<string, any>, query: Record<string, any>, args: any, schemeDef?: any): void;
}

export interface GenerateOptions {
  baseUrl?: string;
  securityHandlers?: Record<string, SecurityHandler>;
  httpRequest?: (method: string, url: string, options?: { headers?: any; body?: any; timeoutMs?: number }) => Promise<{ statusCode: number; statusMessage?: string; headers?: any; body: string }>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args?: any) => Promise<any>;
}

export function buildHeaders(extra?: Record<string, string>): Record<string, string>;
export function makeHttpRequest(method: string, url: string, options?: { headers?: any; body?: any; timeoutMs?: number }): Promise<{ statusCode: number; statusMessage?: string; headers?: any; body: string }>;
export function makeUrl(baseUrlString: string, pathname: string, query?: Record<string, any>): string;
export function generateMcpTools(openApiSpec: string | object, options?: GenerateOptions): Promise<McpTool[]>;

