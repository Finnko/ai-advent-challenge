import { accessSync } from 'node:fs'
import { join } from 'node:path'

export type McpServerSpec = {
  name: string
  envKey: string
  compiledFile: string
  sourcePath: string
  hiddenTools?: string[]
  childEnvKey?: string | null
}

export type McpServerConfig<K extends string = string> = {
  kind: K
  name: string
  entry: string
  childEnv: () => Record<string, string> | undefined
  hiddenTools: string[]
}

export type McpRegistry<K extends string = string> = {
  readonly kinds: readonly K[]
  configs(): McpServerConfig<K>[]
  configFor(kind: K): McpServerConfig<K> | undefined
}

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
  return join(process.cwd(), spec.sourcePath)
}

function resolveEntry<K extends string>(
  specs: Record<K, McpServerSpec>,
  kind: K,
): string {
  const spec = specs[kind]
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

function childEnvFor(
  spec: McpServerSpec,
): () => Record<string, string> | undefined {
  return () => {
    if (!spec.childEnvKey) {
      return undefined
    }
    const value = process.env[spec.childEnvKey]
    return value ? { [spec.childEnvKey]: value } : undefined
  }
}

export function createMcpRegistry<K extends string>(
  specs: Record<K, McpServerSpec>,
): McpRegistry<K> {
  const kinds = Object.keys(specs) as K[]

  const toConfig = (kind: K): McpServerConfig<K> => {
    const spec = specs[kind]
    return {
      kind,
      name: spec.name,
      entry: resolveEntry(specs, kind),
      childEnv: childEnvFor(spec),
      hiddenTools: spec.hiddenTools ?? [],
    }
  }

  return {
    kinds,
    configs() {
      return kinds.map(toConfig)
    },
    configFor(kind) {
      return specs[kind] ? toConfig(kind) : undefined
    },
  }
}
