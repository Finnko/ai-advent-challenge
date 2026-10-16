import { countTokens } from 'gpt-tokenizer'
import type { LlmMessage } from './types'

export function estimateTokens(text: string): number {
  return countTokens(text)
}

export function estimateMessagesTokens(messages: LlmMessage[]): number {
  return messages.reduce(
    (sum, message) => sum + countTokens(message.content),
    0,
  )
}
