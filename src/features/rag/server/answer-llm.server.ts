import { apiKeyFor, callCompletions } from '@lib/llm.server'
import type { ChatUsage, DeepSeekParams } from '@lib/llm'
import { TIER_ENDPOINTS } from '@lib/llm'
import type { PromptMessage } from '../domain/answer-prompt'

export const ANSWER_TEMPERATURE = 0
export const ANSWER_MAX_TOKENS = 700

export type AnswerLlmResult = {
  content: string
  usage: ChatUsage | null
  latencyMs: number
}

export type AnswerLlm = (messages: PromptMessage[]) => Promise<AnswerLlmResult>

export function createDeepSeekLlm(params: DeepSeekParams): AnswerLlm {
  return async (messages) => {
    const reply = await callCompletions(
      TIER_ENDPOINTS.medium,
      apiKeyFor('DEEPSEEK_API_KEY'),
      messages,
      params,
    )
    return {
      content: reply.content,
      usage: reply.usage,
      latencyMs: reply.latencyMs ?? 0,
    }
  }
}

export function createDeepSeekAnswerLlm(): AnswerLlm {
  return createDeepSeekLlm({
    temperature: ANSWER_TEMPERATURE,
    max_tokens: ANSWER_MAX_TOKENS,
  })
}
