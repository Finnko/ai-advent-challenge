import type { Tool } from '@lib/agent-loop/types'
import { openMcpSession, type McpSession } from '@lib/mcp/client.server'
import { buildMcpTools } from '@lib/mcp/tools'
import { devAssistantMcpRegistry } from './mcp-registry.server'

const FILE_TOOL_REPORT_MAX_CHARS = 20000

export type DevAssistantToolbox = {
  tools: Tool[]
  close(): Promise<void>
}

export async function openDevAssistantTools(): Promise<DevAssistantToolbox> {
  const configs = devAssistantMcpRegistry.configs()
  const opened = await Promise.all(
    configs.map(async (config) => ({
      config,
      result: await openMcpSession(config),
    })),
  )
  const sessions: McpSession[] = []
  const tools: Tool[] = []
  for (const { config, result } of opened) {
    if (!result.ok) {
      continue
    }
    const listed = await result.session.listTools()
    if (!listed.ok) {
      await result.session.close()
      continue
    }
    sessions.push(result.session)
    const visible = listed.tools.filter(
      (tool) => !config.hiddenTools.includes(tool.name),
    )
    tools.push(
      ...buildMcpTools(
        visible,
        (name, args) => result.session.call(name, args),
        { maxChars: FILE_TOOL_REPORT_MAX_CHARS },
      ),
    )
  }

  return {
    tools,
    async close() {
      await Promise.all(sessions.map((session) => session.close()))
    },
  }
}
