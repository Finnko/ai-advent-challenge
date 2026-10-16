import type { ChatUsage } from '@lib/llm'
import type { AnswerLlm } from '@lib/rag-engine.server'
import {
  assertIndexBuilt,
  buildSourceMessages,
  resolveAnswerLlm,
  searchSources,
} from '@lib/rag-engine.server'
import type {
  AnswerGenerator,
  Embedder,
  RagIndexStore,
  ScoredChunk,
  SearchScope,
} from '@lib/rag-engine.types'
import { REVIEW_PERSONA, REVIEW_QUESTION } from '../domain/review-prompt'
import { parseReviewReport, type ReviewReport } from '../domain/review-report'
import { REVIEW_STRATEGY } from './review-chunker.server'

export const REVIEW_K = 8

export const REVIEW_MAX_TOKENS = 4000

// Same policy as the chat scope — cosine top-k, no cross-encoder, no rewrite —
// but over the wider review corpus (docs + code).
const REVIEW_SCOPE: SearchScope = {
  strategy: REVIEW_STRATEGY,
  k: REVIEW_K,
  rerank: false,
  rewrite: false,
}

export type PullRequestReviewInput = {
  question?: string
  store: RagIndexStore
  generator: AnswerGenerator
  contextBlocks?: string[]
  llm?: AnswerLlm
  embedder?: Embedder
}

export type PullRequestReviewResult = {
  report: ReviewReport
  question: string
  model: string | null
  usage: ChatUsage | null
  latencyMs: number
  sources: ScoredChunk[]
  contextUsed: boolean
}

// The Day-32 sibling of `answerAboutProject`: the same deep seams
// (`searchSources` → `buildSourceMessages` → the model), a review persona and
// the review JSON contract instead of the answering one. Headless — the diff,
// the changed-files list and the typecheck output all arrive as plain
// `contextBlocks`, so the core never learns where they came from.
export async function reviewPullRequest(
  input: PullRequestReviewInput,
): Promise<PullRequestReviewResult> {
  assertIndexBuilt(input.store, REVIEW_STRATEGY)
  const question = input.question ?? REVIEW_QUESTION
  const contextBlocks = (input.contextBlocks ?? []).filter(
    (block) => block.trim().length > 0,
  )
  const retrieval = await searchSources({
    scope: REVIEW_SCOPE,
    query: question,
    store: input.store,
    embedder: input.embedder,
  })
  const llm = input.llm ?? resolveAnswerLlm(input.generator)
  const messages = buildSourceMessages({
    question,
    persona: REVIEW_PERSONA,
    chunks: retrieval.sources.map((source) => source.chunk),
    contextBlocks,
  })
  const reply = await llm(messages, { json: true, maxTokens: REVIEW_MAX_TOKENS })
  return {
    report: parseReviewReport(reply.content),
    question,
    model: reply.model,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
    sources: retrieval.sources,
    contextUsed: contextBlocks.length > 0,
  }
}
