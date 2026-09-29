import { useQuery } from '@tanstack/react-query'
import type { ChunkingStrategyId } from '../domain/types'
import { listChunks } from '../functions/list-chunks.functions'

export function useRagChunks(strategy: ChunkingStrategyId, limit = 50) {
  return useQuery({
    queryKey: ['rag', 'chunks', strategy, limit] as const,
    queryFn: () => listChunks({ data: { strategy, limit } }),
    staleTime: 5_000,
  })
}
