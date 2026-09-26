import type { AgentTool } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import { callToolOn, listToolsFor } from './mcp.server'
import { mcpServerConfigs } from './mcp-registry.server'

export async function loadMcpTools(): Promise<AgentTool[]> {
  const servers = mcpServerConfigs()
  const results = await Promise.all(
    servers.map(async (config) => ({
      config,
      result: await listToolsFor(config),
    })),
  )
  const tools: AgentTool[] = []
  for (const { config, result } of results) {
    if (!result.ok) {
      continue
    }
    const visible = result.tools.filter(
      (tool) => !config.hiddenTools.includes(tool.name),
    )
    tools.push(
      ...buildMcpAgentTools(visible, (name, args) =>
        callToolOn(config, name, args),
      ),
    )
  }
  return tools
}
