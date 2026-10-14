import { formatNumberedSources } from '@lib/source-format'
import type { Chunk } from './types'

export type PromptMessage = {
  role: 'system' | 'user'
  content: string
}

// What an answering path contributes to the shared "sources → answer" steps:
// the system prompt, the heading of the fragments block, and whether a live
// context block can rescue a weak retrieval.
export type AnswerPersona = {
  system: string
  fragmentsHeader: string
  contextHeader: string | null
  contextRescues: boolean
  json: boolean
  abstain: (question: string) => string
}

export type SourceMessagesInput = {
  question: string
  persona: AnswerPersona
  chunks: Chunk[]
  contextBlocks?: string[]
}

export function buildSourceMessages(
  input: SourceMessagesInput,
): PromptMessage[] {
  const parts: string[] = []
  if (input.chunks.length > 0) {
    parts.push(
      formatNumberedSources(input.chunks, {
        header: input.persona.fragmentsHeader,
      }),
    )
  }
  const contextBlocks = (input.contextBlocks ?? []).filter(
    (block) => block.trim().length > 0,
  )
  const contextHeader = input.persona.contextHeader
  if (contextBlocks.length > 0 && contextHeader) {
    parts.push(`${contextHeader}:\n\n${contextBlocks.join('\n\n')}`)
  }
  parts.push(`Вопрос: ${input.question}`)
  return [
    { role: 'system', content: input.persona.system },
    { role: 'user', content: parts.join('\n\n') },
  ]
}
