import { apiKeyFor, callCompletions } from '@lib/llm.server'
import type { ChatUsage } from '@lib/llm'
import { TIER_ENDPOINTS } from '@lib/llm'
import { buildAnswerMessages } from '../domain/answer-prompt'
import type { PromptMessage } from '../domain/answer-prompt'
import { verdictFor } from '../domain/answer-eval'
import type { AnswerVerdict } from '../domain/answer-eval'
import type { Embedder } from '../domain/embedder'
import type { AnswerMode, ChunkingStrategyId, ScoredChunk } from '../domain/types'
import { createEmbedder } from './embedder.server'
import type { RagIndexStore } from './index-store.server'
import { getRagStore } from './index-store.server'
import { searchChunks } from './retrieval.server'

export const ANSWER_TEMPERATURE = 0
export const ANSWER_MAX_TOKENS = 700

export type AnswerLlmResult = {
  content: string
  usage: ChatUsage | null
  latencyMs: number
}

export type AnswerLlm = (messages: PromptMessage[]) => Promise<AnswerLlmResult>

export type AnswerDeps = {
  embedder: Embedder
  store: RagIndexStore
  llm: AnswerLlm
}

export function createDeepSeekAnswerLlm(): AnswerLlm {
  return async (messages) => {
    const reply = await callCompletions(
      TIER_ENDPOINTS.medium,
      apiKeyFor('DEEPSEEK_API_KEY'),
      messages,
      { temperature: ANSWER_TEMPERATURE, max_tokens: ANSWER_MAX_TOKENS },
    )
    return {
      content: reply.content,
      usage: reply.usage,
      latencyMs: reply.latencyMs ?? 0,
    }
  }
}

export async function defaultAnswerDeps(): Promise<AnswerDeps> {
  return {
    embedder: createEmbedder(),
    store: await getRagStore(),
    llm: createDeepSeekAnswerLlm(),
  }
}

export type AnswerInput = {
  mode: AnswerMode
  strategy: ChunkingStrategyId
  query: string
  k: number
  expected?: string[]
  expectedSources?: string[]
}

export type AnswerResponse = {
  mode: AnswerMode
  query: string
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

async function retrieveSources(
  input: AnswerInput,
  deps: AnswerDeps,
): Promise<ScoredChunk[]> {
  if (input.mode !== 'rag') {
    return []
  }
  if (deps.store.countChunks(input.strategy) === 0) {
    throw emptyIndexError(input.strategy)
  }
  return searchChunks({
    strategy: input.strategy,
    query: input.query,
    k: input.k,
    embedder: deps.embedder,
    store: deps.store,
  })
}

export async function answerQuestion(
  input: AnswerInput,
  deps: AnswerDeps,
): Promise<AnswerResponse> {
  const sources = await retrieveSources(input, deps)
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
    query: input.query,
    answer: reply.content,
    sources,
    verdict,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
  }
}
