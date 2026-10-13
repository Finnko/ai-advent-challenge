import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { McpRegistry, McpServerConfig } from './registry.server'
import type {
  JsonValue,
  McpCallResult,
  McpToolDescriptor,
  McpToolsResult,
  ToolArgs,
} from './types'

const CLIENT_NAME = 'ai-advent-mcp-client'

type SpawnConfig = Pick<McpServerConfig, 'name' | 'entry' | 'childEnv'>

// Sources are `.ts` and executed by Node directly, which does not read
// tsconfig paths; the loader teaches it the same `@/` and `@lib/` aliases the
// bundlers use. Compiled `.mjs` bundles need nothing extra.
function spawnArgs(entry: string): string[] {
  if (!entry.endsWith('.ts')) {
    return ['--no-warnings', entry]
  }
  const loader =
    process.env.MCP_ALIAS_LOADER?.trim() ||
    join(process.cwd(), 'scripts', 'mcp-alias-loader.mjs')
  return ['--no-warnings', '--import', loader, entry]
}

function isMutatingAnnotations(annotations: Tool['annotations']): boolean {
  return annotations?.readOnlyHint !== true
}

function toDescriptor(tool: Tool, server: string): McpToolDescriptor {
  return {
    name: tool.name,
    title: tool.title ?? null,
    description: tool.description ?? null,
    inputSchema: (tool.inputSchema ?? {}) as JsonValue,
    server,
    mutating: isMutatingAnnotations(tool.annotations),
  }
}

async function withClient<T>(
  config: SpawnConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: spawnArgs(config.entry),
    stderr: 'ignore',
    env: config.childEnv(),
  })
  const client = new Client({ name: CLIENT_NAME, version: '1.0.0' })
  try {
    await client.connect(transport)
    return await fn(client)
  } finally {
    await client.close()
  }
}

export async function listToolsFor(
  config: SpawnConfig,
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
  config: SpawnConfig,
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

export type ToolCall = { name: string; args: ToolArgs }

export async function callToolsFor(
  config: SpawnConfig,
  calls: ToolCall[],
): Promise<McpCallResult[]> {
  try {
    return await withClient(config, async (client) => {
      const results: McpCallResult[] = []
      for (const call of calls) {
        const result = await client.callTool({
          name: call.name,
          arguments: call.args,
        })
        const text = extractText(result.content)
        results.push(
          result.isError
            ? { ok: false, error: text || 'Инструмент MCP вернул ошибку.' }
            : { ok: true, text },
        )
      }
      return results
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return calls.map(() => ({ ok: false, error: message }))
  }
}

export type McpHost<K extends string = string> = {
  configs(): McpServerConfig<K>[]
  listTools(): Promise<McpToolsResult>
  callToolOnServer(
    kind: K,
    name: string,
    args: ToolArgs,
  ): Promise<McpCallResult>
  callTool(name: string, args: ToolArgs): Promise<McpCallResult>
}

export function createMcpHost<K extends string>(
  registry: McpRegistry<K>,
): McpHost<K> {
  return {
    configs: () => registry.configs(),
    async listTools() {
      const results = await Promise.all(
        registry.configs().map((config) => listToolsFor(config)),
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
    },
    async callToolOnServer(kind, name, args) {
      const config = registry.configFor(kind)
      if (!config) {
        return { ok: false, error: `MCP-сервер ${kind} не сконфигурирован.` }
      }
      return callToolOn(config, name, args)
    },
    async callTool(name, args) {
      for (const config of registry.configs()) {
        const listed = await listToolsFor(config)
        if (listed.ok && listed.tools.some((tool) => tool.name === name)) {
          return callToolOn(config, name, args)
        }
      }
      return {
        ok: false,
        error: `MCP-инструмент ${name} не найден ни на одном сервере.`,
      }
    },
  }
}
