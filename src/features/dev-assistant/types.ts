import type { ChatUsage } from '@lib/llm'
import type {
  AnswerGenerator,
  AnswerQuote,
  ScoredChunk,
} from '@lib/rag-engine.types'
import type { GitContext } from '@lib/git-context.types'

export type {
  AnswerGenerator,
  AnswerQuote,
  ScoredChunk,
} from '@lib/rag-engine.types'
export type { GitContext, GitContextSection } from '@lib/git-context.types'
export type { CorpusFile, CorpusGroup } from './data/corpus-manifest'

export type DevAssistantAnswer = {
  question: string
  answer: string
  format: 'json' | 'text'
  abstained: boolean
  generator: AnswerGenerator
  model: string | null
  usage: ChatUsage | null
  latencyMs: number
  reranked: boolean
  sources: ScoredChunk[]
  quotes: AnswerQuote[]
  contextUsed: boolean
  gitContext: GitContext
}

export type DevAssistantDocument = {
  id: string
  title: string
  source: string
  charCount: number
  nTokens: number
  indexedAt: string
}

export type DevAssistantIndexStats = {
  documents: DevAssistantDocument[]
  chunkCount: number
  model: string | null
  builtAt: string | null
  dim: number
  embedModel: string
}

export type DevAssistantCorpusDoc = {
  id: string
  title: string
  source: string
  cached: boolean
  charCount: number | null
}

export type DevAssistantAnswerInput = {
  question: string
  generator?: AnswerGenerator
}
