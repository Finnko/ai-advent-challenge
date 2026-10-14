import type { ChatUsage } from '@lib/llm'
import {
  answerFromSources,
  assertIndexBuilt,
  searchSources,
} from '@lib/rag-engine.server'
import type {
  AnswerGenerator,
  AnswerQuote,
  ChunkingStrategyId,
  RagIndexStore,
  ScoredChunk,
  SearchScope,
} from '@lib/rag-engine.types'
import { PROJECT_PERSONA } from '../domain/prompt'

export const DEV_ASSISTANT_STRATEGY: ChunkingStrategyId = 'markdown'
export const DEV_ASSISTANT_K = 6

// Cosine top-k, no cross-encoder: the project corpus is small and coherent, and
// the reranker (tuned for the wiki benchmark) under-scores broad questions such
// as "what features does the project have?".
const DOCS_SCOPE: SearchScope = {
  strategy: DEV_ASSISTANT_STRATEGY,
  k: DEV_ASSISTANT_K,
  rerank: false,
  rewrite: false,
}

export type ProjectAnswerInput = {
  question: string
  store: RagIndexStore
  generator: AnswerGenerator
  contextBlocks?: string[]
}

export type ProjectAnswerResult = {
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
}

// The headless core: no UI, no HTTP, no MCP. `contextBlocks` is plain text —
// today the git MCP server supplies it, tomorrow a GitHub Action can. This is
// the single entry point Day 32's review pipeline will call.
export async function answerAboutProject(
  input: ProjectAnswerInput,
): Promise<ProjectAnswerResult> {
  assertIndexBuilt(input.store, DOCS_SCOPE.strategy)
  const retrieval = await searchSources({
    scope: DOCS_SCOPE,
    query: input.question,
    store: input.store,
  })
  const answer = await answerFromSources({
    question: input.question,
    persona: PROJECT_PERSONA,
    retrieval,
    contextBlocks: input.contextBlocks,
    generator: input.generator,
  })
  return {
    question: input.question,
    answer: answer.answer,
    format: answer.format,
    abstained: answer.abstained,
    generator: input.generator,
    model: answer.model,
    usage: answer.usage,
    latencyMs: answer.latencyMs,
    reranked: retrieval.reranked,
    sources: answer.sources,
    quotes: answer.quotes,
    contextUsed: answer.contextUsed,
  }
}
