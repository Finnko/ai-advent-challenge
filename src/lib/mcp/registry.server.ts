import { accessSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  resolveEntry(kind: K): string
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

function sourceEntry(spec: McpServerSpec, baseUrl: string): string {
  return fileURLToPath(new URL(spec.sourcePath, baseUrl))
}

function resolveEntry<K extends string>(
  specs: Record<K, McpServerSpec>,
  baseUrl: string,
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
  return sourceEntry(spec, baseUrl)
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
  baseUrl: string,
): McpRegistry<K> {
  const kinds = Object.keys(specs) as K[]

  const toConfig = (kind: K): McpServerConfig<K> => {
    const spec = specs[kind]
    return {
      kind,
      name: spec.name,
      entry: resolveEntry(specs, baseUrl, kind),
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
    resolveEntry(kind) {
      return resolveEntry(specs, baseUrl, kind)
    },
  }
}
