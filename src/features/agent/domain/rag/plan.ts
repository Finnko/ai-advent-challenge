import type { CapabilityTurn } from '../capabilities/types'

export type RagQueryPlan = { kind: 'live' } | { kind: 'search'; query: string }

export type RagRewriter = (
  query: string,
  history?: CapabilityTurn[],
) => Promise<string | null>

const LIVE_MARKERS = [
  'погод',
  'прогноз',
  'пробк',
  'котировк',
  'курс валют',
  'курс доллара',
  'курс евро',
  'курс рубля',
  'в реальном времени',
  'онлайн',
  'live',
]

export function isLiveRequest(query: string): boolean {
  const normalized = query.toLowerCase().replace(/ё/g, 'е')
  return LIVE_MARKERS.some((marker) => normalized.includes(marker))
}

export async function planRagQuery(input: {
  query: string
  history?: CapabilityTurn[]
  rewrite?: RagRewriter | null
}): Promise<RagQueryPlan> {
  if (isLiveRequest(input.query)) {
    return { kind: 'live' }
  }
  const rewritten = input.rewrite
    ? await input.rewrite(input.query, input.history)
    : null
  const trimmed = rewritten?.trim()
  return {
    kind: 'search',
    query: trimmed && trimmed.length > 0 ? trimmed : input.query,
  }
}
