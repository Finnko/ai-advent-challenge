import type { AgentTool, ToolArgs, ToolOutcome } from '../agent'
import { formatArgsExample } from './args-example'
import type { McpCallResult, McpToolDescriptor } from './types'

export const MCP_TOOL_PREFIX = 'mcp_'

export type McpToolCall = (
  name: string,
  args: ToolArgs,
) => Promise<McpCallResult>

function toolDescription(tool: McpToolDescriptor): string {
  return tool.description ?? tool.title ?? tool.name
}

function toOutcome(result: McpCallResult): ToolOutcome {
  if (result.ok) {
    return { ok: true, text: result.text, reference: null }
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
      run: async (args) => toOutcome(await call(descriptor.name, args)),
    }),
  )
}
