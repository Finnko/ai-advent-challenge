import type { ChatUsage } from '@lib/llm'
import { parseAnswerResponse } from '../domain/answer-format'
import { abstainAnswer, buildAnswerMessages } from '../domain/answer-prompt'
import { verdictFor, verifyQuotes } from '../domain/answer-eval'
import type { AnswerQuote, AnswerVerdict } from '../domain/answer-eval'
import {
  resolvePipeline,
  type PipelineConfig,
  type RagPipelineId,
} from '../domain/pipelines'
import { cosineOf, relevanceOf } from '../domain/scoring'
import type {
  AnswerGenerator,
  AnswerMode,
  ChunkingStrategyId,
  ScoredChunk,
} from '../domain/types'
import {
  ANSWER_MAX_TOKENS,
  ANSWER_TEMPERATURE,
  createDeepSeekAnswerLlm,
  createDeepSeekLlm,
} from './answer-llm.server'
import { runPipeline, type PipelineRunResult } from './pipeline-run.server'
import {
  resolveAnswerRuntime,
  type AnswerRuntime,
  type AnswerRuntimeOverrides,
} from './runtime.server'
import { stitchSources, type RetrievalResult } from './retrieval.server'

export type { AnswerLlm, AnswerLlmResult } from './answer-llm.server'
export {
  ANSWER_MAX_TOKENS,
  ANSWER_TEMPERATURE,
  createDeepSeekLlm,
  createDeepSeekAnswerLlm,
}

export type AnswerInput = {
  mode: AnswerMode
  strategy: ChunkingStrategyId
  query: string
  k: number
  generator?: AnswerGenerator
  pipeline?: RagPipelineId
  stitch?: boolean
  expected?: string[]
  expectedSources?: string[]
}

export type AnswerResponse = {
  mode: AnswerMode
  generator: AnswerGenerator
  model: string | null
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

async function runRetrieval(
  input: AnswerInput,
  deps: AnswerRuntime,
  config: PipelineConfig | null,
): Promise<PipelineRunResult> {
  if (config === null) {
    return {
      retrieval: {
        results: [],
        reranked: false,
        candidateCount: 0,
        embeddingQuery: input.query,
      },
      rewrittenQuery: null,
    }
  }
  if (deps.store.countChunks(input.strategy) === 0) {
    throw emptyIndexError(input.strategy)
  }
  return runPipeline(
    config,
    {
      strategy: input.strategy,
      query: input.query,
      k: input.k,
      threshold: deps.threshold,
    },
    {
      embedder: deps.embedder,
      store: deps.store,
      reranker: deps.reranker,
      rewriter: deps.rewriter,
      margin: deps.margin,
    },
  )
}

function confidence(result: RetrievalResult): number | null {
  const top = result.results[0]
  if (!top) {
    return null
  }
  return result.reranked ? relevanceOf(top) : cosineOf(top)
}

function shouldAbstain(
  config: PipelineConfig | null,
  retrieval: RetrievalResult,
  deps: AnswerRuntime,
): boolean {
  if (config === null) {
    return false
  }
  if (retrieval.results.length === 0) {
    return true
  }
  const threshold = retrieval.reranked ? deps.threshold : deps.cosineThreshold
  const score = confidence(retrieval)
  return score !== null && score < threshold
}

export async function answerQuestion(
  input: AnswerInput,
  overrides: AnswerRuntimeOverrides = {},
): Promise<AnswerResponse> {
  const generator = input.generator ?? 'cloud'
  const deps = await resolveAnswerRuntime(overrides, generator)
  const config = pipelineConfig(input)
  const { retrieval, rewrittenQuery } = await runRetrieval(input, deps, config)
  const base = {
    mode: input.mode,
    generator,
    pipeline: config ? (input.pipeline ?? 'rag') : null,
    query: input.query,
    embeddingQuery: retrieval.embeddingQuery,
    rewrittenQuery,
    reranked: retrieval.reranked,
  }
  if (shouldAbstain(config, retrieval, deps)) {
    return {
      ...base,
      model: null,
      answer: abstainAnswer(input.query),
      format: 'text',
      sources: [],
      quotes: [],
      abstained: true,
      verdict: input.expected ? 'abstained' : null,
      usage: null,
      latencyMs: 0,
    }
  }
  const sources =
    input.stitch && config !== null
      ? stitchSources(retrieval.results, deps.store, input.strategy)
      : retrieval.results
  const chunks = sources.map((source) => source.chunk)
  const messages = buildAnswerMessages({
    question: input.query,
    mode: input.mode,
    chunks,
  })
  const reply = await deps.llm(messages, { json: input.mode === 'rag' })
  const parsed = parseAnswerResponse(reply.content)
  const quotes = verifyQuotes(parsed.quotes, chunks)
  const verdict = input.expected
    ? verdictFor({
        mode: input.mode,
        answer: parsed.answer,
        expected: input.expected,
        expectedSources: input.expectedSources ?? [],
        chunks,
        quotes,
      })
    : null
  return {
    ...base,
    model: reply.model,
    answer: parsed.answer,
    format: parsed.format,
    sources,
    quotes,
    abstained: false,
    verdict,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
  }
}
