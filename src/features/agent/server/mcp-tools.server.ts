import type { AgentTool } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import { callTool, listMcpTools } from './mcp.server'

export async function loadMcpTools(): Promise<AgentTool[]> {
  const result = await listMcpTools()
  if (!result.ok) {
    return []
  }
  return buildMcpAgentTools(result.tools, callTool)
}
