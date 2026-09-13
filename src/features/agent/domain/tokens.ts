import { countTokens } from 'gpt-tokenizer'
import type { LlmMessage } from './agent'

export const CONTEXT_BUDGET_TOKENS = 4096
export const MODEL_CONTEXT_TOKENS = 1_000_000
export const PRICE_INPUT_PER_1M = 0.15
export const PRICE_INPUT_CACHE_HIT_PER_1M = 0.003
export const PRICE_OUTPUT_PER_1M = 0.6

export function estimateTokens(text: string): number {
  return countTokens(text)
}

export function estimateMessagesTokens(messages: LlmMessage[]): number {
  return messages.reduce(
    (sum, message) => sum + countTokens(message.content),
    0,
  )
}

export type CostBreakdown = {
  cacheHitTokens: number
  cacheMissTokens: number
  completionTokens: number
}

export function costUsd({
  cacheHitTokens,
  cacheMissTokens,
  completionTokens,
}: CostBreakdown): number {
  return (
    (cacheHitTokens / 1_000_000) * PRICE_INPUT_CACHE_HIT_PER_1M +
    (cacheMissTokens / 1_000_000) * PRICE_INPUT_PER_1M +
    (completionTokens / 1_000_000) * PRICE_OUTPUT_PER_1M
  )
}

export function savedUsd(before: number, after: number): number {
  return Math.max(0, before - after)
}

function decimalsFor(value: number): number {
  if (value < 0.01) {
    return 5
  }
  if (value < 0.1) {
    return 4
  }
  return 3
}

export function formatUsd(value: number): string {
  if (value < 0.0001) {
    return '$0.0000'
  }
  return `$${value.toFixed(decimalsFor(value))}`
}
