import type { ChatUsage } from '@lib/llm'
import type { AnswerPersona } from '../domain/answer-persona'
import { buildSourceMessages } from '../domain/answer-persona'
import { parseAnswerResponse } from '../domain/answer-format'
import { verifyQuotes, type AnswerQuote } from '../domain/answer-eval'
import type { AnswerGenerator, Chunk, ScoredChunk } from '../domain/types'
import type { AnswerLlm } from './answer-llm.server'
import { resolveAnswerLlm } from './runtime.server'
import type { SourcesOutcome } from './search.server'

export type SourceAnswerInput = {
  question: string
  persona: AnswerPersona
  /** null means this path answers without retrieval (the baseline mode) */
  retrieval: SourcesOutcome | null
  contextBlocks?: string[]
  generator: AnswerGenerator
  llm?: AnswerLlm
}

export type SourceAnswer = {
  answer: string
  format: 'json' | 'text'
  abstained: boolean
  sources: ScoredChunk[]
  chunks: Chunk[]
  quotes: AnswerQuote[]
  model: string | null
  usage: ChatUsage | null
  latencyMs: number
  contextUsed: boolean
}

function usableContextBlocks(blocks: string[] | undefined): string[] {
  return (blocks ?? []).filter((block) => block.trim().length > 0)
}

// The shared "sources → answer" steps: the abstention gate, the prompt, the
// model call and the quote verification against the very chunks that were sent.
// Personas differ only in prompt text and in whether a context block can rescue
// a weak retrieval.
export async function answerFromSources(
  input: SourceAnswerInput,
): Promise<SourceAnswer> {
  const contextBlocks = usableContextBlocks(input.contextBlocks)
  const contextUsed = contextBlocks.length > 0
  const retrieval = input.retrieval
  const sources = retrieval?.sources ?? []
  const weak = retrieval?.weak === true
  if (retrieval !== null && weak) {
    const rescued = input.persona.contextRescues && contextUsed
    if (!rescued) {
      return {
        answer: input.persona.abstain(input.question),
        format: 'text',
        abstained: true,
        sources: [],
        chunks: [],
        quotes: [],
        model: null,
        usage: null,
        latencyMs: 0,
        contextUsed,
      }
    }
  }
  const chunks = weak ? [] : sources.map((source) => source.chunk)
  const llm = input.llm ?? resolveAnswerLlm(input.generator)
  const messages = buildSourceMessages({
    question: input.question,
    persona: input.persona,
    chunks,
    contextBlocks,
  })
  const reply = await llm(messages, { json: input.persona.json })
  const parsed = parseAnswerResponse(reply.content)
  return {
    answer: parsed.answer,
    format: parsed.format,
    abstained: false,
    sources,
    chunks,
    quotes: verifyQuotes(parsed.quotes, chunks),
    model: reply.model,
    usage: reply.usage,
    latencyMs: reply.latencyMs,
    contextUsed,
  }
}
