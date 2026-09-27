import { accessSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type McpServerKind = 'demo' | 'jobs' | 'research' | 'market'

export type McpServerConfig = {
  kind: McpServerKind
  name: string
  entry: string
  childEnv: () => Record<string, string> | undefined
  hiddenTools: string[]
}

type McpServerSpec = {
  name: string
  envKey: string
  compiledFile: string
  sourcePath: string
  hiddenTools: string[]
  childEnvKey: string | null
}

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

const KINDS = Object.keys(SPECS) as McpServerKind[]

function fileExists(path: string): boolean {
  try {
    accessSync(path)
    return true
  } catch {
    return false
  }
}

function compiledEntry(spec: McpServerSpec): string {
  return join(process.cwd(), 'dist', 'server', 'mcp', spec.compiledFile)
}

function sourceEntry(spec: McpServerSpec): string {
  return fileURLToPath(new URL(spec.sourcePath, import.meta.url))
}

export function resolveMcpEntry(kind: McpServerKind): string {
  const spec = SPECS[kind]
  const override = process.env[spec.envKey]?.trim()
  if (override) {
    return override
  }
  const compiled = compiledEntry(spec)
  if (fileExists(compiled)) {
    return compiled
  }
  return sourceEntry(spec)
}

function childEnvFor(spec: McpServerSpec): () => Record<string, string> | undefined {
  return () => {
    if (!spec.childEnvKey) {
      return undefined
    }
    const value = process.env[spec.childEnvKey]
    return value ? { [spec.childEnvKey]: value } : undefined
  }
}

export function mcpServerConfigs(): McpServerConfig[] {
  return KINDS.map((kind) => {
    const spec = SPECS[kind]
    return {
      kind,
      name: spec.name,
      entry: resolveMcpEntry(kind),
      childEnv: childEnvFor(spec),
      hiddenTools: spec.hiddenTools,
    }
  })
}
