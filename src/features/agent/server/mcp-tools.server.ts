import { callToolOn, createMcpHost, listToolsFor } from '@lib/mcp/client.server'
import type { AgentTool } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import { mcpRegistry, mcpServerConfigs } from './mcp-registry.server'

const host = createMcpHost(mcpRegistry)

export const listMcpTools = host.listTools

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
