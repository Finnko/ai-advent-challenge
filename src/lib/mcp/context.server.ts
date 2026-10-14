import { callToolsFor, type SpawnConfig, type ToolCall } from './client.server'
import type { McpCallResult, StructuredContent, ToolArgs } from './types'

export type McpContextCall = {
  name: string
  args: ToolArgs
  title: string
}

export type McpContextSection = {
  tool: string
  title: string
  text: string
  structured?: StructuredContent
}

export type McpContext = {
  available: boolean
  error: string | null
  sections: McpContextSection[]
  block: string | null
}

export type McpContextRunner = (
  config: SpawnConfig,
  calls: ToolCall[],
) => Promise<McpCallResult[]>

export type McpContextOptions = {
  config: SpawnConfig
  calls: McpContextCall[]
  run?: McpContextRunner
  ttlMs?: number
  now?: () => number
}

// One spawn serves several read-only calls. The short TTL collapses the
// concurrent callers of a single page (a panel and the answer it belongs to)
// into one spawn, without caching repository state for longer than a turn.
export const DEFAULT_CONTEXT_TTL_MS = 1500

type CacheEntry = { at: number; promise: Promise<McpContext> }

const cache = new Map<string, CacheEntry>()

function cacheKey(options: McpContextOptions): string {
  return `${options.config.name}\n${JSON.stringify(options.calls)}`
}

function buildBlock(sections: McpContextSection[]): string | null {
  if (sections.length === 0) {
    return null
  }
  return sections
    .map((section) => `### ${section.title}\n${section.text}`)
    .join('\n\n')
}

async function runCollect(options: McpContextOptions): Promise<McpContext> {
  const run = options.run ?? callToolsFor
  const results = await run(
    options.config,
    options.calls.map((call) => ({ name: call.name, args: call.args })),
  )
  const sections: McpContextSection[] = []
  let firstError: string | null = null
  results.forEach((result, index) => {
    const call = options.calls[index]
    if (!call) {
      return
    }
    if (result.ok) {
      sections.push({
        tool: call.name,
        title: call.title,
        text: result.text,
        structured: result.structured,
      })
      return
    }
    if (!firstError) {
      firstError = result.error
    }
  })
  return {
    available: sections.length > 0,
    error: sections.length > 0 ? null : firstError,
    sections,
    block: buildBlock(sections),
  }
}

export async function collectMcpContext(
  options: McpContextOptions,
): Promise<McpContext> {
  const ttlMs = options.ttlMs ?? DEFAULT_CONTEXT_TTL_MS
  if (ttlMs <= 0) {
    return runCollect(options)
  }
  const key = cacheKey(options)
  const now = (options.now ?? Date.now)()
  const hit = cache.get(key)
  if (hit && now - hit.at < ttlMs) {
    return hit.promise
  }
  const promise = runCollect(options)
  promise.catch(() => cache.delete(key))
  cache.set(key, { at: now, promise })
  return promise
}
