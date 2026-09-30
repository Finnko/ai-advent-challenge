import type { ChunkingStrategyId } from '../types'
import { fixedStrategy, FIXED_CHUNK_OVERLAP, FIXED_CHUNK_TOKENS } from './fixed'
import { structuralStrategy, STRUCTURAL_MAX_TOKENS } from './structural'
import type { ChunkingStrategy } from './types'

export const CHUNKING_STRATEGIES: Record<ChunkingStrategyId, ChunkingStrategy> =
  {
    fixed: fixedStrategy,
    structural: structuralStrategy,
  }

export const CHUNKING_STRATEGY_IDS: ChunkingStrategyId[] = [
  'fixed',
  'structural',
]

export const CHUNKING_LABELS: Record<ChunkingStrategyId, string> = {
  fixed: 'По фиксированному размеру',
  structural: 'По структуре (разделы)',
}

export const CHUNKING_DETAILS: Record<ChunkingStrategyId, string> = {
  fixed: `${FIXED_CHUNK_TOKENS} токенов, перекрытие ${FIXED_CHUNK_OVERLAP}`,
  structural: `разделы статьи до ${STRUCTURAL_MAX_TOKENS} токенов`,
}

export function isChunkingStrategyId(
  value: unknown,
): value is ChunkingStrategyId {
  return value === 'fixed' || value === 'structural'
}

export function resolveChunkingStrategy(
  id: ChunkingStrategyId,
): ChunkingStrategy {
  return CHUNKING_STRATEGIES[id]
}
