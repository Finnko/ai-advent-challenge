import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type {
  JsonValue,
  McpToolDescriptor,
  McpToolsResult,
} from '../domain/mcp/types'

const SERVER_ENTRY = fileURLToPath(new URL('../mcp/server.ts', import.meta.url))

function toDescriptor(tool: Tool): McpToolDescriptor {
  return {
    name: tool.name,
    title: tool.title ?? null,
    description: tool.description ?? null,
    inputSchema: (tool.inputSchema ?? {}) as JsonValue,
  }
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--no-warnings', SERVER_ENTRY],
    stderr: 'ignore',
  })
  const client = new Client({ name: 'agent-mcp-client', version: '1.0.0' })
  try {
    await client.connect(transport)
    return await fn(client)
  } finally {
    await client.close()
  }
}

export async function listMcpTools(): Promise<McpToolsResult> {
  try {
    return await withClient(async (client) => {
      const { tools } = await client.listTools()
      return { ok: true, tools: tools.map(toDescriptor) }
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
