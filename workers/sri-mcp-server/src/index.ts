import { McpAgent } from 'agents/mcp';
import { createServer } from './tools';
import type { Env } from './types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export class SriMcpAgent extends McpAgent<Env> {
  server!: McpServer;

  async init() {
    this.server = createServer(this.env);
  }
}

const mcpHandler = SriMcpAgent.serve('/mcp', { binding: 'SRI_MCP' });
const sseHandler = SriMcpAgent.serveSSE('/sse', { binding: 'SRI_MCP' });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      return mcpHandler.fetch(request, env, ctx);
    }

    if (url.pathname === '/sse' || url.pathname.startsWith('/sse/')) {
      return sseHandler.fetch(request, env, ctx);
    }

    return new Response('SRI MCP Server — usa /mcp o /sse', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
