import type { RetrievalStats, StructuralStats } from './domain/metrics'
import type { Chunk, ChunkingStrategyId, ScoredChunk } from './domain/types'

export type { Chunk, ChunkingStrategyId, ScoredChunk, RetrievalStats, StructuralStats }

export type DocumentRecord = {
  id: string
  title: string
  source: string
  charCount: number
  nTokens: number
  indexedAt: string
}

export type StrategyIndexStats = {
  strategy: ChunkingStrategyId
  chunkCount: number
  model: string | null
  builtAt: string | null
  dim: number
}

export type IndexStats = {
  documents: DocumentRecord[]
  strategies: StrategyIndexStats[]
  embedModel: string
}

export type BuildIndexResult = {
  strategy: ChunkingStrategyId
  documents: number
  chunks: number
  model: string
  dim: number
  builtAt: string
  durationMs: number
}

export type CorpusDocStatus = {
  id: string
  title: string
  source: string
  cached: boolean
  charCount: number | null
}

export type StrategyComparison = {
  strategy: ChunkingStrategyId
  model: string | null
  builtAt: string | null
  structural: StructuralStats
  retrieval: RetrievalStats
}

export type RagComparison = {
  strategies: StrategyComparison[]
  queryCount: number
}
