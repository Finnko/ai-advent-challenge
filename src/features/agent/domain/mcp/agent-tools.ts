export { MCP_TOOL_PREFIX } from '@lib/mcp/tools'

import { buildMcpTools, type McpToolCall } from '@lib/mcp/tools'
import type { AgentTool } from '../agent'
import type { McpToolDescriptor } from './types'

const SERVER_NAME_PREFIX = 'agent-mcp-'

function serverLabel(server: string): string {
  return server.startsWith(SERVER_NAME_PREFIX)
    ? server.slice(SERVER_NAME_PREFIX.length)
    : server
}

function toolDescription(tool: McpToolDescriptor): string {
  const base = tool.description ?? tool.title ?? tool.name
  return tool.server ? `[${serverLabel(tool.server)}] ${base}` : base
}

export function buildMcpAgentTools(
  descriptors: McpToolDescriptor[],
  call: McpToolCall,
): AgentTool[] {
  return buildMcpTools(descriptors, call, { label: toolDescription }).map(
    (tool): AgentTool => ({ ...tool, roles: ['employee', 'manager'] }),
  )
}
