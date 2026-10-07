import type { CompletionEndpoint } from '@lib/llm'
import { resolveLocalBaseUrl, resolveLocalModel } from '@lib/local-llm.server'

export function parseAllowedUserIds(raw: string | undefined): number[] {
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function resolveQuizModel(): string {
  return process.env.QUIZ_LLM_MODEL?.trim() || resolveLocalModel()
}

export function resolveQuizEndpoint(): CompletionEndpoint {
  return {
    baseUrl: resolveLocalBaseUrl(),
    model: resolveQuizModel(),
    withThinking: false,
  }
}
