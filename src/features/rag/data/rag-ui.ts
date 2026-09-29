import type { ChunkingStrategyId } from '../domain/types'

export const STRATEGY_IDS: ChunkingStrategyId[] = ['fixed', 'structural']

export const STRATEGY_LABELS: Record<ChunkingStrategyId, string> = {
  fixed: 'По фиксированному размеру',
  structural: 'По структуре (разделы)',
}

export const STRATEGY_SHORT_LABELS: Record<ChunkingStrategyId, string> = {
  fixed: 'fixed',
  structural: 'structural',
}

export const STRATEGY_DETAILS: Record<ChunkingStrategyId, string> = {
  fixed: '256 токенов, перекрытие 32',
  structural: 'разделы статьи до 256 токенов',
}
