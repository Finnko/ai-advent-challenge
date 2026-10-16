import type { Tool, ToolArgs, ToolOutcome } from '@lib/agent-loop/types'
import { formatArgsExample } from './args-example'
import type { McpCallResult, McpToolDescriptor } from './types'

export const MCP_TOOL_PREFIX = 'mcp_'

export const MCP_TOOL_REPORT_MAX_CHARS = 8000

export const MCP_TOOL_TRUNCATION_HINT =
  'Сузь окно инструмента (например, startLine/maxLines) или передай вывод ссылкой $ref.'

export type McpToolCall = (
  name: string,
  args: ToolArgs,
) => Promise<McpCallResult>

export type McpToolOptions = {
  prefix?: string
  label?: (descriptor: McpToolDescriptor) => string
  maxChars?: number
}

function truncateReport(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n…(обрезано: ${text.length} символов из ${maxChars}. ${MCP_TOOL_TRUNCATION_HINT})`
}

function toOutcome(result: McpCallResult, maxChars: number): ToolOutcome {
  if (result.ok) {
    const text = truncateReport(result.text, maxChars)
    return text === result.text
      ? { ok: true, text, reference: null }
      : { ok: true, text, reference: null, refText: result.text }
  }
  return { ok: false, text: `MCP: ${result.error}`, reference: null }
}

export function buildMcpTools(
  descriptors: McpToolDescriptor[],
  call: McpToolCall,
  options: McpToolOptions = {},
): Tool[] {
  const prefix = options.prefix ?? MCP_TOOL_PREFIX
  const maxChars = options.maxChars ?? MCP_TOOL_REPORT_MAX_CHARS
  return descriptors.map((descriptor): Tool => {
    const base = descriptor.description ?? descriptor.title ?? descriptor.name
    return {
      name: `${prefix}${descriptor.name}`,
      description: options.label ? options.label(descriptor) : base,
      argsExample: formatArgsExample(descriptor.inputSchema),
      mutating: descriptor.mutating,
      run: async (args) =>
        toOutcome(await call(descriptor.name, args), maxChars),
    }
  })
}
