import type { ChatUsage } from '@lib/llm'
import {
  cosineOf,
  createAnswerLlm,
  createEmbedder,
  parseAnswerResponse,
  resolveCosineThreshold,
  retrieve,
  verifyQuotes,
  type RagIndexStore,
} from '@lib/rag-engine.server'
import type {
  AnswerGenerator,
  AnswerQuote,
  ChunkingStrategyId,
  ScoredChunk,
} from '@lib/rag-engine.types'
import { abstainAnswer, buildProjectMessages } from '../domain/prompt'

export type ProjectAnswerInput = {
  question: string
  strategy: ChunkingStrategyId
  store: RagIndexStore
  generator: AnswerGenerator
  k: number
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
  const contextBlocks = (input.contextBlocks ?? []).filter(
    (block) => block.trim().length > 0,
  )
  const hasContext = contextBlocks.length > 0
  // Cosine top-k, no cross-encoder: the project corpus is small and coherent,
  // and the reranker (tuned for the wiki benchmark) under-scores broad
  // questions like "what features does the project have?". See README.
  const retrieval = await retrieve({
    strategy: input.strategy,
    query: input.question,
    k: input.k,
    embedder: createEmbedder(),
    store: input.store,
    reranker: null,
    threshold: null,
  })
  const sources = retrieval.results
  const top = sources[0]
  const confidence = top ? cosineOf(top) : null
  const cutoff = resolveCosineThreshold()
  const weak =
    sources.length === 0 || (confidence !== null && confidence < cutoff)

  const base = {
    question: input.question,
    generator: input.generator,
    reranked: retrieval.reranked,
    contextUsed: hasContext,
  }

  // Abstain only when the docs say nothing AND there is no live repository
  // context to fall back on. A pure "what branch am I on?" question must still
  // get an answer.
  if (weak && !hasContext) {
    return {
      ...base,
      answer: abstainAnswer(input.question),
      format: 'text',
      abstained: true,
      model: null,
      usage: null,
      latencyMs: 0,
      sources: [],
      quotes: [],
    }
  }

  const chunks = weak ? [] : sources.map((source) => source.chunk)
  const messages = buildProjectMessages({
    question: input.question,
    chunks,
    contextBlocks,
  })
  const reply = await createAnswerLlm(input.generator)(messages, { json: true })
  const parsed = parseAnswerResponse(reply.content)
  const quotes = verifyQuotes(parsed.quotes, chunks)
  return {
    ...base,
    answer: parsed.answer,
    format: parsed.format,
    abstained: false,
    model: reply.model,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
    sources,
    quotes,
  }
}
