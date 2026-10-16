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
  StructuredContent,
  ToolArgs,
} from './types'

const CLIENT_NAME = 'ai-advent-mcp-client'

export type SpawnConfig = Pick<McpServerConfig, 'name' | 'entry' | 'childEnv'>

export type ToolCall = { name: string; args: ToolArgs }

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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toTransport(config: SpawnConfig): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: spawnArgs(config.entry),
    stderr: 'ignore',
    env: config.childEnv(),
  })
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

async function listToolsWith(
  client: Client,
  config: SpawnConfig,
): Promise<McpToolsResult> {
  const { tools } = await client.listTools()
  return {
    ok: true,
    tools: tools.map((tool) => toDescriptor(tool, config.name)),
  }
}

async function callToolWith(
  client: Client,
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  const result = await client.callTool({ name, arguments: args })
  const text = extractText(result.content)
  if (result.isError) {
    return { ok: false, error: text || 'Инструмент MCP вернул ошибку.' }
  }
  return {
    ok: true,
    text,
    structured: result.structuredContent as StructuredContent | undefined,
  }
}

async function withClient<T>(
  config: SpawnConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: CLIENT_NAME, version: '1.0.0' })
  try {
    await client.connect(toTransport(config))
    return await fn(client)
  } finally {
    await client.close()
  }
}

export async function listToolsFor(
  config: SpawnConfig,
): Promise<McpToolsResult> {
  try {
    return await withClient(config, (client) => listToolsWith(client, config))
  } catch (error) {
    return { ok: false, error: errorText(error) }
  }
}

export async function callToolOn(
  config: SpawnConfig,
  name: string,
  args: ToolArgs,
): Promise<McpCallResult> {
  try {
    return await withClient(config, (client) =>
      callToolWith(client, name, args),
    )
  } catch (error) {
    return { ok: false, error: errorText(error) }
  }
}

export async function callToolsFor(
  config: SpawnConfig,
  calls: ToolCall[],
): Promise<McpCallResult[]> {
  try {
    return await withClient(config, async (client) => {
      const results: McpCallResult[] = []
      for (const call of calls) {
        results.push(await callToolWith(client, call.name, call.args))
      }
      return results
    })
  } catch (error) {
    const message = errorText(error)
    return calls.map(() => ({ ok: false, error: message }))
  }
}

// A session keeps one server process alive for the whole run: the tool loop
// makes many calls per turn, and `callToolOn` would spawn Node for each one.
export type McpSession = {
  name: string
  listTools(): Promise<McpToolsResult>
  call(name: string, args: ToolArgs): Promise<McpCallResult>
  close(): Promise<void>
}

export type OpenSessionResult =
  { ok: true; session: McpSession } | { ok: false; error: string }

export async function openMcpSession(
  config: SpawnConfig,
): Promise<OpenSessionResult> {
  const client = new Client({ name: CLIENT_NAME, version: '1.0.0' })
  try {
    await client.connect(toTransport(config))
  } catch (error) {
    return { ok: false, error: errorText(error) }
  }
  return {
    ok: true,
    session: {
      name: config.name,
      listTools: () => listToolsWith(client, config),
      async call(name, args) {
        try {
          return await callToolWith(client, name, args)
        } catch (error) {
          return { ok: false, error: errorText(error) }
        }
      },
      close: () => client.close(),
    },
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
  }
}
