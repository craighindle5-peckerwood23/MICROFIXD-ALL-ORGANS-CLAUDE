// src/autonomy/mcp-adapter.ts
//
// The real MCP adapter -- flagged in the earlier audit as discussed but
// never built. Uses @modelcontextprotocol/sdk (the real, official
// TypeScript SDK), not a hand-rolled approximation of the protocol.
//
// Scope decision, matching the existing OmniRouter/PluginRegistry
// pattern rather than inventing a third governance shape: MCP servers
// are pre-registered via MICROFIXD_MCP_SERVERS_JSON (same idea as
// MICROFIXD_PLUGINS_JSON), each with a real URL and an optional bearer
// token pulled from a named env var (never accepted inline). Only the
// remote Streamable HTTP transport is supported here, deliberately --
// stdio transport means spawning arbitrary local subprocesses, which is
// a materially different and larger risk surface than calling a
// pre-configured remote server, and isn't needed for the real use case
// (connecting to hosted MCP servers) this closes.
//
// Governance: listing a server's tools is read-only discovery, ungated.
// Actually calling a tool is exactly as consequential as any other
// external effect (internet-agent.ts, OmniRouter) and goes through the
// same proposeGovernedAction approval flow at the route layer.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface McpServerConfig {
  id: string;
  url: string;
  bearerTokenEnv?: string;
}

export function loadMcpServers(): McpServerConfig[] {
  const source = process.env.MICROFIXD_MCP_SERVERS_JSON;
  if (!source) return [];
  try {
    const parsed = JSON.parse(source) as McpServerConfig[];
    if (!Array.isArray(parsed)) throw new Error('MICROFIXD_MCP_SERVERS_JSON must contain an array.');
    return parsed;
  } catch (err) {
    throw new Error(`MICROFIXD_MCP_SERVERS_JSON is not valid JSON: ${(err as Error).message}`);
  }
}

function getServerConfig(serverId: string): McpServerConfig {
  const server = loadMcpServers().find((s) => s.id === serverId);
  if (!server) throw new Error(`No MCP server registered with id "${serverId}". Check MICROFIXD_MCP_SERVERS_JSON.`);
  return server;
}

async function connect(server: McpServerConfig): Promise<Client> {
  const headers: Record<string, string> = {};
  if (server.bearerTokenEnv) {
    const token = process.env[server.bearerTokenEnv];
    if (!token) throw new Error(`MCP server "${server.id}" requires env var "${server.bearerTokenEnv}", which is not set.`);
    headers.Authorization = `Bearer ${token}`;
  }
  const transport = new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } });
  const client = new Client({ name: 'microfixd', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

export interface McpToolSummary {
  name: string;
  description?: string;
  inputSchema: unknown;
}

/** Real, live discovery -- actually connects and asks the server for its real tool list. Read-only, ungated. */
export async function listServerTools(serverId: string): Promise<McpToolSummary[]> {
  const server = getServerConfig(serverId);
  const client = await connect(server);
  try {
    const result = await client.listTools();
    return result.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  } finally {
    await client.close();
  }
}

export interface McpCallResult {
  isError: boolean;
  content: unknown;
}

/** Real, live tool invocation. Caller (the route) is responsible for approval-gating this before it's ever reached -- this function has no opinion on governance, same division of responsibility as internet-agent.ts's callExternalApi. */
export async function callServerTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult> {
  const server = getServerConfig(serverId);
  const client = await connect(server);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    return { isError: Boolean(result.isError), content: result.content };
  } finally {
    await client.close();
  }
}
