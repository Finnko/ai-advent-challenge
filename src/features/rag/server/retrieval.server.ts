import type { Embedder } from '../domain/embedder'
import { dot } from '../domain/embedder'
import type { ChunkingStrategyId, ScoredChunk } from '../domain/types'
import type { RagIndexStore } from './index-store.server'

export type SearchOptions = {
  strategy: ChunkingStrategyId
  query: string
  k: number
  embedder: Embedder
  store: RagIndexStore
}

export async function searchChunks(
  options: SearchOptions,
): Promise<ScoredChunk[]> {
  const query = options.query.trim()
  if (query.length === 0) {
    return []
  }
  const [queryVector] = await options.embedder.embed([query], 'query')
  const stored = options.store.listStoredChunks(options.strategy)
  const scored: ScoredChunk[] = stored.map(({ chunk, embedding }) => ({
    chunk,
    score: dot(queryVector, embedding),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(1, options.k))
}
