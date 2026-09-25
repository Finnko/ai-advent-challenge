import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolArgs } from '../domain/agent'
import type {
  JsonValue,
  McpCallResult,
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

function childEnv(): Record<string, string> | undefined {
  const dbPath = process.env.AGENT_DB_PATH
  return dbPath ? { AGENT_DB_PATH: dbPath } : undefined
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--no-warnings', SERVER_ENTRY],
    stderr: 'ignore',
    env: childEnv(),
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

function extractText(content: unknown): string {
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') {
        return ''
      }
      const text = (block as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .filter((text) => text.length > 0)
    .join('\n')
}

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  try {
    return await withClient(async (client) => {
      const result = await client.callTool({ name, arguments: args })
      const text = extractText(result.content)
      if (result.isError) {
        return { ok: false, error: text || 'Инструмент MCP вернул ошибку.' }
      }
      return { ok: true, text }
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
