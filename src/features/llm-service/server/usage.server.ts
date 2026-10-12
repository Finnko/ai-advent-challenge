import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'

export type UsageEntry = {
  ts: string
  keyId: string
  ip: string
  model: string
  ok: boolean
  status: number
  stream: boolean
  promptTokens: number
  completionTokens: number
  latencyMs: number
}

export type KeyStats = {
  keyId: string
  requests: number
  errors: number
  promptTokens: number
  completionTokens: number
}

export type UsageTracker = {
  record: (entry: UsageEntry) => void
  snapshot: () => KeyStats[]
}

export function expandHome(filePath: string): string {
  if (filePath === '~' || filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2))
  }
  return filePath
}

function createFileAppender(filePath: string): (line: string) => Promise<void> {
  const absolute = expandHome(filePath)
  let ready: Promise<void> | null = null
  return async (line: string) => {
    ready ??= mkdir(dirname(absolute), { recursive: true }).then(
      () => undefined,
    )
    await ready
    await appendFile(absolute, `${line}\n`, 'utf8')
  }
}

export function createUsageTracker(
  deps: {
    filePath?: string | null
    append?: (line: string) => Promise<void>
  } = {},
): UsageTracker {
  const counters = new Map<string, KeyStats>()
  const append =
    deps.append ?? (deps.filePath ? createFileAppender(deps.filePath) : null)

  return {
    record(entry) {
      const current = counters.get(entry.keyId) ?? {
        keyId: entry.keyId,
        requests: 0,
        errors: 0,
        promptTokens: 0,
        completionTokens: 0,
      }
      current.requests += 1
      if (!entry.ok) {
        current.errors += 1
      }
      current.promptTokens += entry.promptTokens
      current.completionTokens += entry.completionTokens
      counters.set(entry.keyId, current)

      if (append) {
        void append(JSON.stringify(entry)).catch(() => undefined)
      }
    },
    snapshot() {
      return [...counters.values()].sort((a, b) =>
        a.keyId.localeCompare(b.keyId),
      )
    },
  }
}
