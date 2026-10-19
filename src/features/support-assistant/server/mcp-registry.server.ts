import {
  createMcpRegistry,
  type McpServerConfig,
  type McpServerSpec,
} from '@lib/mcp/registry.server'

export type SupportMcpKind = 'ozon'

const SPECS: Record<SupportMcpKind, McpServerSpec> = {
  ozon: {
    name: 'support-mcp-ozon',
    envKey: 'SUPPORT_MCP_OZON_ENTRY',
    compiledFile: 'mcp-support-ozon.mjs',
    sourcePath: 'src/features/support-assistant/mcp/ozon/server.ts',
    hiddenTools: [],
    childEnvKey: 'SUPPORT_FIXTURES_DIR',
  },
}

export const supportMcpRegistry = createMcpRegistry(SPECS)

export function ozonServerConfig():
  McpServerConfig<SupportMcpKind> | undefined {
  return supportMcpRegistry.configFor('ozon')
}
