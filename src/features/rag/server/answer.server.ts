import type { ChatUsage } from '@lib/llm'
import { buildAnswerMessages } from '../domain/answer-prompt'
import { verdictFor } from '../domain/answer-eval'
import type { AnswerVerdict } from '../domain/answer-eval'
import type { Embedder } from '../domain/embedder'
import {
  DEFAULT_RERANK_THRESHOLD,
  resolvePipeline,
  type PipelineConfig,
  type RagPipelineId,
} from '../domain/pipelines'
import type { Reranker } from '../domain/reranker'
import { rewriteQuery, type Rewriter } from '../domain/rewrite-prompt'
import type {
  AnswerMode,
  ChunkingStrategyId,
  ScoredChunk,
} from '../domain/types'
import type { AnswerLlm } from './answer-llm.server'
import { createDeepSeekAnswerLlm } from './answer-llm.server'
import { createEmbedder } from './embedder.server'
import type { RagIndexStore } from './index-store.server'
import { getRagStore } from './index-store.server'
import {
  createReranker,
  resolveRerankMargin,
  resolveRerankThreshold,
} from './reranker.server'
import { retrieve, type RetrievalResult } from './retrieval.server'
import { createDefaultRewriter } from './rewrite.server'

export type { AnswerLlm, AnswerLlmResult } from './answer-llm.server'
export {
  ANSWER_MAX_TOKENS,
  ANSWER_TEMPERATURE,
  createDeepSeekLlm,
} from './answer-llm.server'
export { createDeepSeekAnswerLlm }

export type AnswerDeps = {
  embedder: Embedder
  store: RagIndexStore
  llm: AnswerLlm
  reranker?: Reranker | null
  rewriter?: Rewriter | null
  threshold?: number
  margin?: number
}

export async function defaultAnswerDeps(): Promise<AnswerDeps> {
  return {
    embedder: createEmbedder(),
    store: await getRagStore(),
    llm: createDeepSeekAnswerLlm(),
    reranker: createReranker(),
    rewriter: createDefaultRewriter(),
    threshold: resolveRerankThreshold(),
    margin: resolveRerankMargin(),
  }
}

export type AnswerInput = {
  mode: AnswerMode
  strategy: ChunkingStrategyId
  query: string
  k: number
  pipeline?: RagPipelineId
  expected?: string[]
  expectedSources?: string[]
}

export type AnswerResponse = {
  mode: AnswerMode
  pipeline: RagPipelineId | null
  query: string
  embeddingQuery: string
  rewrittenQuery: string | null
  reranked: boolean
  answer: string
  sources: ScoredChunk[]
  verdict: AnswerVerdict | null
  usage: ChatUsage | null
  latencyMs: number
}

function emptyIndexError(strategy: ChunkingStrategyId): Error {
  return new Error(
    `Индекс стратегии «${strategy}» пуст — соберите его во вкладке «Индекс».`,
  )
}

function pipelineConfig(input: AnswerInput): PipelineConfig | null {
  if (input.mode !== 'rag') {
    return null
  }
  return resolvePipeline(input.pipeline ?? 'rag')
}

async function retrieveSources(
  input: AnswerInput,
  deps: AnswerDeps,
  config: PipelineConfig | null,
  rewrittenQuery: string | null,
): Promise<RetrievalResult> {
  if (config === null) {
    return {
      results: [],
      reranked: false,
      candidateCount: 0,
      embeddingQuery: input.query,
    }
  }
  if (deps.store.countChunks(input.strategy) === 0) {
    throw emptyIndexError(input.strategy)
  }
  return retrieve({
    strategy: input.strategy,
    query: input.query,
    k: input.k,
    embedder: deps.embedder,
    store: deps.store,
    reranker: config.rerank ? (deps.reranker ?? null) : null,
    threshold: config.rerank
      ? (deps.threshold ?? DEFAULT_RERANK_THRESHOLD)
      : null,
    margin: config.rerank ? deps.margin : null,
    rewrittenQuery,
  })
}

export async function answerQuestion(
  input: AnswerInput,
  deps: AnswerDeps,
): Promise<AnswerResponse> {
  const config = pipelineConfig(input)
  const rewrittenQuery = config?.rewrite
    ? await rewriteQuery(input.query, deps.rewriter)
    : null
  const retrieval = await retrieveSources(input, deps, config, rewrittenQuery)
  const sources = retrieval.results
  const chunks = sources.map((source) => source.chunk)
  const messages = buildAnswerMessages({
    question: input.query,
    mode: input.mode,
    chunks,
  })
  const reply = await deps.llm(messages)
  const verdict = input.expected
    ? verdictFor({
        mode: input.mode,
        answer: reply.content,
        expected: input.expected,
        expectedSources: input.expectedSources ?? [],
        chunks,
      })
    : null
  return {
    mode: input.mode,
    pipeline: config ? (input.pipeline ?? 'rag') : null,
    query: input.query,
    embeddingQuery: retrieval.embeddingQuery,
    rewrittenQuery,
    reranked: retrieval.reranked,
    answer: reply.content,
    sources,
    verdict,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
  }
}
