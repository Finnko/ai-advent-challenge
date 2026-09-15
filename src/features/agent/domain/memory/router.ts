import type {
  MemoryCandidate,
  MemoryEntry,
  MemoryLayer,
  MemorySource,
} from './types'
import { MAX_MEMORY_VALUE_CHARS } from './types'
import { isMemoryLayer } from './read'

const LONG_TERM_HINTS = [
  'профил',
  'предпочт',
  'любл',
  'не любл',
  'привыч',
  'стиль',
  'политик',
  'принцип',
  'правил',
  'знан',
  'роль',
  'должност',
  'подчин',
  'команд',
  'решени',
  'имя',
  'отвеча',
]

const WORKING_HINTS = [
  'цель',
  'задач',
  'огранич',
  'срок',
  'дедлайн',
  'бюджет',
  'договор',
  'встреч',
  'заявк',
  'бронь',
  'проект',
  'тз',
  'текущ',
  'контекст',
]

function normalizeKey(key: string): string {
  return key.trim().toLowerCase()
}

function hintLayer(text: string): MemoryLayer {
  const lower = text.toLowerCase()
  if (WORKING_HINTS.some((hint) => lower.includes(hint))) {
    return 'working'
  }
  if (LONG_TERM_HINTS.some((hint) => lower.includes(hint))) {
    return 'long-term'
  }
  return 'working'
}

function resolveLayer(candidate: MemoryCandidate): MemoryLayer | null {
  if (candidate.layer === null || candidate.layer === undefined) {
    return hintLayer(`${candidate.key} ${candidate.value}`)
  }
  if (candidate.layer === ('short-term' as unknown)) {
    return hintLayer(`${candidate.key} ${candidate.value}`)
  }
  if (isMemoryLayer(candidate.layer)) {
    return candidate.layer
  }
  return null
}

export type MemoryRouteInput = {
  candidates: MemoryCandidate[]
  source?: MemorySource
  scenario?: string | null
  now?: string
}

export const MemoryRouter = {
  route(input: MemoryRouteInput): MemoryEntry[] {
    const source = input.source ?? 'auto'
    const now = input.now ?? new Date().toISOString()
    const routed = new Map<string, MemoryEntry>()
    for (const candidate of input.candidates) {
      const key = candidate.key.trim()
      const value = candidate.value.trim()
      if (key.length === 0 || value.length === 0) {
        continue
      }
      if (value.length > MAX_MEMORY_VALUE_CHARS) {
        continue
      }
      const layer = resolveLayer(candidate)
      if (layer === null) {
        continue
      }
      const dedupeKey = `${layer}::${normalizeKey(key)}`
      routed.set(dedupeKey, {
        layer,
        key,
        value,
        source,
        updatedAt: now,
        scenario: input.scenario ?? null,
      })
    }
    return [...routed.values()]
  },
}

export function routeMemories(input: MemoryRouteInput): MemoryEntry[] {
  return MemoryRouter.route(input)
}
