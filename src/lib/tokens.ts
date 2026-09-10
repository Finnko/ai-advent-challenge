import { countTokens } from 'gpt-tokenizer'
import type { LlmMessage } from './agent'

export const CONTEXT_BUDGET_TOKENS = 4096
export const MODEL_CONTEXT_TOKENS = 1_000_000
export const PRICE_INPUT_PER_1M = 0.15
export const PRICE_OUTPUT_PER_1M = 0.6

export function estimateTokens(text: string): number {
  return countTokens(text)
}

export function estimateMessagesTokens(messages: LlmMessage[]): number {
  return messages.reduce((sum, message) => sum + countTokens(message.content), 0)
}

export function costUsd(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1_000_000) * PRICE_INPUT_PER_1M +
    (completionTokens / 1_000_000) * PRICE_OUTPUT_PER_1M
  )
}

export function formatUsd(value: number): string {
  return value < 0.0001
    ? '$0.0000'
    : `$${value.toFixed(value < 0.01 ? 5 : value < 0.1 ? 4 : 3)}`
}
