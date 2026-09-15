export type MemoryLayer = 'working' | 'long-term'

export type MemorySource = 'auto' | 'manual'

export type MemoryEntry = {
  layer: MemoryLayer
  key: string
  value: string
  source: MemorySource
  updatedAt: string
  scenario?: string | null
}

export type MemoryCandidate = {
  layer?: MemoryLayer | null
  key: string
  value: string
}

export type MemorySnapshot = {
  working: MemoryEntry[]
  longTerm: MemoryEntry[]
}

export const MEMORY_LAYERS: MemoryLayer[] = ['working', 'long-term']

export const MAX_MEMORY_VALUE_CHARS = 280

export const LONG_TERM_LIMIT = 50

export const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  working: 'Рабочая память (текущая задача)',
  'long-term': 'Долговременная память (профиль, решения, знания)',
}

export const EMPTY_MEMORY: MemorySnapshot = {
  working: [],
  longTerm: [],
}
