import type { ChatUsage } from '@lib/llm'
import type { AnswerQuote, AnswerVerdict } from './domain/answer-eval'
import type { RetrievalStats, StructuralStats } from './domain/metrics'
import type { RagPipelineId } from './domain/pipelines'
import type {
  AnswerMode,
  Chunk,
  ChunkingStrategyId,
  ScoredChunk,
} from './domain/types'

export type {
  AnswerMode,
  AnswerQuote,
  AnswerVerdict,
  Chunk,
  ChunkingStrategyId,
  RagPipelineId,
  ScoredChunk,
  RetrievalStats,
  StructuralStats,
}
export type { ControlQuestion } from './data/control-questions'

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

export type PipelineRetrieval = {
  pipeline: RagPipelineId
  retrieval: RetrievalStats
}

export type StrategyComparison = {
  strategy: ChunkingStrategyId
  model: string | null
  builtAt: string | null
  structural: StructuralStats
  retrieval: RetrievalStats
  pipelines: PipelineRetrieval[]
}

export type RagComparison = {
  strategies: StrategyComparison[]
  queryCount: number
  includeRewrite: boolean
}

export type RagSearchResult = {
  results: ScoredChunk[]
  reranked: boolean
  candidateCount: number
  embeddingQuery: string
  rewrittenQuery: string | null
}

export type AnswerResult = {
  mode: AnswerMode
  pipeline: RagPipelineId | null
  query: string
  embeddingQuery: string
  rewrittenQuery: string | null
  reranked: boolean
  answer: string
  format: 'json' | 'text'
  sources: ScoredChunk[]
  quotes: AnswerQuote[]
  abstained: boolean
  verdict: AnswerVerdict | null
  usage: ChatUsage | null
  latencyMs: number
}

export type AnswerInput = {
  mode: AnswerMode
  strategy: ChunkingStrategyId
  query: string
  k?: number
  pipeline?: RagPipelineId
  stitch?: boolean
  expected?: string[]
  expectedSources?: string[]
}
