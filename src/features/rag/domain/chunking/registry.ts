import type { RagChunkingStrategyId } from '../types'
import { fixedStrategy, FIXED_CHUNK_OVERLAP, FIXED_CHUNK_TOKENS } from './fixed'
import { structuralStrategy, STRUCTURAL_MAX_TOKENS } from './structural'
import type { ChunkingStrategy } from './types'

export const CHUNKING_STRATEGIES: Record<
  RagChunkingStrategyId,
  ChunkingStrategy
> = {
  fixed: fixedStrategy,
  structural: structuralStrategy,
}

export const CHUNKING_STRATEGY_IDS: RagChunkingStrategyId[] = [
  'fixed',
  'structural',
]

export const CHUNKING_LABELS: Record<RagChunkingStrategyId, string> = {
  fixed: 'По фиксированному размеру',
  structural: 'По структуре (разделы)',
}

export const CHUNKING_DETAILS: Record<RagChunkingStrategyId, string> = {
  fixed: `${FIXED_CHUNK_TOKENS} токенов, перекрытие ${FIXED_CHUNK_OVERLAP}`,
  structural: `разделы статьи до ${STRUCTURAL_MAX_TOKENS} токенов`,
}

export function isChunkingStrategyId(
  value: unknown,
): value is RagChunkingStrategyId {
  return value === 'fixed' || value === 'structural'
}

export function resolveChunkingStrategy(
  id: RagChunkingStrategyId,
): ChunkingStrategy {
  return CHUNKING_STRATEGIES[id]
}
