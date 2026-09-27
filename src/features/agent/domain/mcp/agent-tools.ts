import type { AgentTool, ToolArgs, ToolOutcome } from '../agent'
import { formatArgsExample } from './args-example'
import {
  MCP_TOOL_REPORT_MAX_CHARS,
  type McpCallResult,
  type McpToolDescriptor,
} from './types'

export const MCP_TOOL_PREFIX = 'mcp_'

const SERVER_NAME_PREFIX = 'agent-mcp-'

export type McpToolCall = (
  name: string,
  args: ToolArgs,
) => Promise<McpCallResult>

function serverLabel(server: string): string {
  return server.startsWith(SERVER_NAME_PREFIX)
    ? server.slice(SERVER_NAME_PREFIX.length)
    : server
}

function toolDescription(tool: McpToolDescriptor): string {
  const base = tool.description ?? tool.title ?? tool.name
  return tool.server ? `[${serverLabel(tool.server)}] ${base}` : base
}

function truncateReport(text: string): string {
  if (text.length <= MCP_TOOL_REPORT_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, MCP_TOOL_REPORT_MAX_CHARS)}\n…(обрезано)`
}

function toOutcome(result: McpCallResult): ToolOutcome {
  if (result.ok) {
    const text = truncateReport(result.text)
    return text === result.text
      ? { ok: true, text, reference: null }
      : { ok: true, text, reference: null, refText: result.text }
  }
  return { ok: false, text: `MCP: ${result.error}`, reference: null }
}

export function buildMcpAgentTools(
  descriptors: McpToolDescriptor[],
  call: McpToolCall,
): AgentTool[] {
  return descriptors.map(
    (descriptor): AgentTool => ({
      name: `${MCP_TOOL_PREFIX}${descriptor.name}`,
      description: toolDescription(descriptor),
      argsExample: formatArgsExample(descriptor.inputSchema),
      roles: ['employee', 'manager'],
      mutating: descriptor.mutating,
      run: async (args) => toOutcome(await call(descriptor.name, args)),
    }),
  )
}
