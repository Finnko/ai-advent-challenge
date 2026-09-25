import { accessSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type McpServerKind = 'demo' | 'jobs'

export type McpServerConfig = {
  kind: McpServerKind
  name: string
  entry: string
  childEnv: () => Record<string, string> | undefined
  hiddenTools: string[]
}

function fileExists(path: string): boolean {
  try {
    accessSync(path)
    return true
  } catch {
    return false
  }
}

function compiledEntry(kind: McpServerKind): string {
  const filename = kind === 'demo' ? 'mcp-demo.mjs' : 'mcp-jobs.mjs'
  return join(process.cwd(), 'dist', 'server', 'mcp', filename)
}

function sourceEntry(kind: McpServerKind): string {
  const url =
    kind === 'demo'
      ? new URL('../mcp/server.ts', import.meta.url)
      : new URL('../mcp/jobs/server.ts', import.meta.url)
  return fileURLToPath(url)
}

export function resolveMcpEntry(kind: McpServerKind): string {
  const envKey =
    kind === 'demo' ? 'AGENT_MCP_DEMO_ENTRY' : 'AGENT_MCP_JOBS_ENTRY'
  const override = process.env[envKey]?.trim()
  if (override) {
    return override
  }
  const compiled = compiledEntry(kind)
  if (fileExists(compiled)) {
    return compiled
  }
  return sourceEntry(kind)
}

function demoChildEnv(): Record<string, string> | undefined {
  const dbPath = process.env.AGENT_DB_PATH
  return dbPath ? { AGENT_DB_PATH: dbPath } : undefined
}

function jobsChildEnv(): Record<string, string> | undefined {
  const dbPath = process.env.JOBS_DB_PATH
  return dbPath ? { JOBS_DB_PATH: dbPath } : undefined
}

export function mcpServerConfigs(): McpServerConfig[] {
  return [
    {
      kind: 'demo',
      name: 'agent-mcp-demo',
      entry: resolveMcpEntry('demo'),
      childEnv: demoChildEnv,
      hiddenTools: [],
    },
    {
      kind: 'jobs',
      name: 'agent-mcp-jobs',
      entry: resolveMcpEntry('jobs'),
      childEnv: jobsChildEnv,
      hiddenTools: ['run_due_jobs'],
    },
  ]
}
