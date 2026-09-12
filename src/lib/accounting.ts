import type { AgentRunResult, LlmUsage } from './agent'
import { costUsd, estimateTokens } from './tokens'

export type AccountingMessage = {
  role: 'user' | 'assistant'
  content: string
  run?: AgentRunResult
}

export type SessionAccounting = {
  historyTokens: number
  requestTokens: number
  promptTokensActual: number
  responseTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  costUsd: number
  summarizedMessages: number
  runs: number
}

export function accountSession(
  messages: AccountingMessage[],
  draft: string,
): SessionAccounting {
  const historyTokens = messages.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0,
  )
  const requestTokens = estimateTokens(draft)
  return messages.reduce<SessionAccounting>(
    (acc, message) => {
      if (message.role !== 'assistant' || !message.run) {
        return acc
      }
      const tokens = message.run.tokens
      acc.promptTokensActual += tokens.promptTokensActual ?? 0
      acc.responseTokens += tokens.responseTokens ?? 0
      acc.cacheHitTokens += tokens.cacheHitTokens ?? 0
      acc.cacheMissTokens += tokens.cacheMissTokens ?? 0
      acc.costUsd += tokens.costUsd ?? 0
      acc.summarizedMessages = Math.max(
        acc.summarizedMessages,
        tokens.summarizedMessages ?? 0,
      )
      acc.runs += 1
      return acc
    },
    {
      historyTokens,
      requestTokens,
      promptTokensActual: 0,
      responseTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      costUsd: 0,
      summarizedMessages: 0,
      runs: 0,
    },
  )
}

export function summaryCostUsd(usage: LlmUsage): number {
  const cacheHitTokens = usage.prompt_cache_hit_tokens ?? 0
  const cacheMissTokens =
    usage.prompt_cache_miss_tokens ??
    Math.max(0, usage.prompt_tokens - cacheHitTokens)
  return costUsd({
    cacheHitTokens,
    cacheMissTokens,
    completionTokens: usage.completion_tokens,
  })
}
