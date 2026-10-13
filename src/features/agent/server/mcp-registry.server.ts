import {
  createMcpRegistry,
  type McpServerConfig,
  type McpServerSpec,
} from '@lib/mcp/registry.server'

export type { McpServerConfig } from '@lib/mcp/registry.server'

export type McpServerKind = 'demo' | 'jobs' | 'research' | 'market'

const SPECS: Record<McpServerKind, McpServerSpec> = {
  demo: {
    name: 'agent-mcp-demo',
    envKey: 'AGENT_MCP_DEMO_ENTRY',
    compiledFile: 'mcp-demo.mjs',
    sourcePath: '../mcp/server.ts',
    hiddenTools: [],
    childEnvKey: 'AGENT_DB_PATH',
  },
  jobs: {
    name: 'agent-mcp-jobs',
    envKey: 'AGENT_MCP_JOBS_ENTRY',
    compiledFile: 'mcp-jobs.mjs',
    sourcePath: '../mcp/jobs/server.ts',
    hiddenTools: ['run_due_jobs'],
    childEnvKey: 'JOBS_DB_PATH',
  },
  research: {
    name: 'agent-mcp-research',
    envKey: 'AGENT_MCP_RESEARCH_ENTRY',
    compiledFile: 'mcp-research.mjs',
    sourcePath: '../mcp/research/server.ts',
    hiddenTools: [],
    childEnvKey: 'REPORTS_DIR',
  },
  market: {
    name: 'agent-mcp-market',
    envKey: 'AGENT_MCP_MARKET_ENTRY',
    compiledFile: 'mcp-market.mjs',
    sourcePath: '../mcp/market/server.ts',
    hiddenTools: [],
    childEnvKey: null,
  },
}

export const mcpRegistry = createMcpRegistry(SPECS, import.meta.url)

export function mcpServerConfigs(): McpServerConfig<McpServerKind>[] {
  return mcpRegistry.configs()
}

export function resolveMcpEntry(kind: McpServerKind): string {
  return mcpRegistry.resolveEntry(kind)
}
