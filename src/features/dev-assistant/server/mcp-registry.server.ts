import {
  createMcpRegistry,
  type McpServerConfig,
  type McpServerSpec,
} from '@lib/mcp/registry.server'

export type DevAssistantMcpKind = 'git'

const SPECS: Record<DevAssistantMcpKind, McpServerSpec> = {
  git: {
    name: 'dev-assistant-mcp-git',
    envKey: 'DEV_ASSISTANT_MCP_GIT_ENTRY',
    compiledFile: 'mcp-git.mjs',
    sourcePath: 'src/features/dev-assistant/mcp/git/server.ts',
    hiddenTools: [],
    childEnvKey: 'GIT_REPO_DIR',
  },
}

export const devAssistantMcpRegistry = createMcpRegistry(SPECS)

export function gitServerConfig():
  McpServerConfig<DevAssistantMcpKind> | undefined {
  return devAssistantMcpRegistry.configFor('git')
}
