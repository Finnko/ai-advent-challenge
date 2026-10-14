import type { ChatUsage } from '@lib/llm'
import { personaFor } from '../domain/answer-prompt'
import {
  verdictFor,
  type AnswerQuote,
  type AnswerVerdict,
} from '../domain/answer-eval'
import type { PipelineConfig, RagPipelineId } from '../domain/pipelines'
import { resolvePipeline } from '../domain/pipelines'
import type { SearchScope } from '../domain/search-scope'
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
import { assertIndexBuilt } from './index-store.server'
import {
  resolveAnswerRuntime,
  type AnswerRuntime,
  type AnswerRuntimeOverrides,
} from './runtime.server'
import { searchSources, type SourcesOutcome } from './search.server'
import { answerFromSources, type SourceAnswer } from './source-answer.server'

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

function pipelineConfig(input: AnswerInput): PipelineConfig | null {
  if (input.mode !== 'rag') {
    return null
  }
  return resolvePipeline(input.pipeline ?? 'rag')
}

function scopeFor(input: AnswerInput, config: PipelineConfig): SearchScope {
  return {
    strategy: input.strategy,
    k: input.k,
    rerank: config.rerank,
    rewrite: config.rewrite,
    stitch: input.stitch === true,
  }
}

async function runRetrieval(
  input: AnswerInput,
  deps: AnswerRuntime,
  config: PipelineConfig,
): Promise<SourcesOutcome> {
  assertIndexBuilt(deps.store, input.strategy)
  return searchSources({
    scope: scopeFor(input, config),
    query: input.query,
    store: deps.store,
    embedder: deps.embedder,
    reranker: deps.reranker,
    rewriter: deps.rewriter,
    rerankThreshold: deps.threshold,
    cosineThreshold: deps.cosineThreshold,
    margin: deps.margin,
  })
}

function verdictOf(
  input: AnswerInput,
  result: SourceAnswer,
): AnswerVerdict | null {
  if (!input.expected) {
    return null
  }
  if (result.abstained) {
    return 'abstained'
  }
  return verdictFor({
    mode: input.mode,
    answer: result.answer,
    expected: input.expected,
    expectedSources: input.expectedSources ?? [],
    chunks: result.chunks,
    quotes: result.quotes,
  })
}

export async function answerQuestion(
  input: AnswerInput,
  overrides: AnswerRuntimeOverrides = {},
): Promise<AnswerResponse> {
  const generator = input.generator ?? 'cloud'
  const deps = await resolveAnswerRuntime(overrides, generator)
  const config = pipelineConfig(input)
  const retrieval =
    config === null ? null : await runRetrieval(input, deps, config)
  const result = await answerFromSources({
    question: input.query,
    persona: personaFor(input.mode),
    retrieval,
    generator,
    llm: deps.llm,
  })
  return {
    mode: input.mode,
    generator,
    model: result.model,
    pipeline: config ? (input.pipeline ?? 'rag') : null,
    query: input.query,
    embeddingQuery: retrieval?.embeddingQuery ?? input.query,
    rewrittenQuery: retrieval?.rewrittenQuery ?? null,
    reranked: retrieval?.reranked ?? false,
    answer: result.answer,
    format: result.format,
    sources: result.sources,
    quotes: result.quotes,
    abstained: result.abstained,
    verdict: verdictOf(input, result),
    usage: result.usage,
    latencyMs: result.latencyMs,
  }
}
