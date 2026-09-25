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
import {
  mcpServerConfigs,
  type McpServerConfig,
  type McpServerKind,
} from './mcp-registry.server'

function toDescriptor(tool: Tool, server: string): McpToolDescriptor {
  return {
    name: tool.name,
    title: tool.title ?? null,
    description: tool.description ?? null,
    inputSchema: (tool.inputSchema ?? {}) as JsonValue,
    server,
  }
}

async function withClient<T>(
  config: McpServerConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--no-warnings', config.entry],
    stderr: 'ignore',
    env: config.childEnv(),
  })
  const client = new Client({ name: 'agent-mcp-client', version: '1.0.0' })
  try {
    await client.connect(transport)
    return await fn(client)
  } finally {
    await client.close()
  }
}

export async function listToolsFor(
  config: McpServerConfig,
): Promise<McpToolsResult> {
  try {
    return await withClient(config, async (client) => {
      const { tools } = await client.listTools()
      return {
        ok: true,
        tools: tools.map((tool) => toDescriptor(tool, config.name)),
      }
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

export async function callToolOn(
  config: McpServerConfig,
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  try {
    return await withClient(config, async (client) => {
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

export async function listMcpTools(): Promise<McpToolsResult> {
  const results = await Promise.all(
    mcpServerConfigs().map((config) => listToolsFor(config)),
  )
  const tools: McpToolDescriptor[] = []
  const errors: string[] = []
  for (const result of results) {
    if (result.ok) {
      tools.push(...result.tools)
    } else {
      errors.push(result.error)
    }
  }
  if (tools.length === 0 && errors.length > 0) {
    return { ok: false, error: errors.join('; ') }
  }
  return { ok: true, tools }
}

export async function callToolOnServer(
  kind: McpServerKind,
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  const config = mcpServerConfigs().find((server) => server.kind === kind)
  if (!config) {
    return { ok: false, error: `MCP-сервер ${kind} не сконфигурирован.` }
  }
  return callToolOn(config, name, args)
}

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  for (const config of mcpServerConfigs()) {
    const listed = await listToolsFor(config)
    if (listed.ok && listed.tools.some((tool) => tool.name === name)) {
      return callToolOn(config, name, args)
    }
  }
  return {
    ok: false,
    error: `MCP-инструмент ${name} не найден ни на одном сервере.`,
  }
}
