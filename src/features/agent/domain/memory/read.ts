import type { SystemBlock } from '../agent'
import type {
  MemoryEntry,
  MemoryLayer,
  MemorySnapshot,
  MemorySource,
} from './types'
import { LONG_TERM_LIMIT, MEMORY_LAYERS } from './types'

export function isMemoryLayer(value: unknown): value is MemoryLayer {
  return MEMORY_LAYERS.includes(value as MemoryLayer)
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

function mergeKey(entry: MemoryEntry): string {
  return `${entry.layer}::${normalizeKey(entry.key)}`
}

export function mergeMemoryEntries(
  existing: MemoryEntry[],
  incoming: MemoryEntry[],
): MemoryEntry[] {
  const merged = new Map<string, MemoryEntry>()
  for (const entry of existing) {
    if (normalizeKey(entry.key).length === 0) {
      continue
    }
    merged.set(mergeKey(entry), entry)
  }
  for (const entry of incoming) {
    const key = mergeKey(entry)
    const current = merged.get(key)
    if (current && current.source === 'manual' && entry.source === 'auto') {
      continue
    }
    merged.set(key, entry)
  }
  return [...merged.values()]
}

export function applyLongTermLimit(
  entries: MemoryEntry[],
  limit = LONG_TERM_LIMIT,
): MemoryEntry[] {
  if (entries.length <= limit) {
    return entries
  }
  const kept = [...entries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
  return kept.sort((a, b) => a.key.localeCompare(b.key))
}

export function formatMemoryBlock(
  layer: MemoryLayer,
  entries: MemoryEntry[],
): string {
  if (entries.length === 0) {
    return ''
  }
  const title =
    layer === 'working'
      ? 'РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ:'
      : 'ДОЛГОВРЕМЕННАЯ ПАМЯТЬ (профиль, решения, знания):'
  const lines = entries.map((entry) => `- ${entry.key}: ${entry.value}`)
  return `${title}\n${lines.join('\n')}`
}

export function buildMemoryBlocks(snapshot: MemorySnapshot): SystemBlock[] {
  return [
    { kind: 'long-term' as const, content: formatMemoryBlock('long-term', snapshot.longTerm) },
    { kind: 'working' as const, content: formatMemoryBlock('working', snapshot.working) },
  ].filter((block) => block.content.length > 0)
}

export function memorySnapshot(
  working: MemoryEntry[],
  longTerm: MemoryEntry[],
): MemorySnapshot {
  return { working, longTerm }
}

export function memorySourceLabel(source: MemorySource): string {
  return source === 'manual' ? 'вручную' : 'авто'
}
