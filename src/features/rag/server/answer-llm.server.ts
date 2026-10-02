import { apiKeyFor, callCompletions } from '@lib/llm.server'
import type { ChatUsage, DeepSeekParams } from '@lib/llm'
import { TIER_ENDPOINTS } from '@lib/llm'
import type { PromptMessage } from '../domain/answer-prompt'

export const ANSWER_TEMPERATURE = 0
export const ANSWER_MAX_TOKENS = 1200

export type AnswerLlmResult = {
  content: string
  usage: ChatUsage | null
  latencyMs: number
}

export type AnswerLlmOptions = {
  json?: boolean
}

export type AnswerLlm = (
  messages: PromptMessage[],
  options?: AnswerLlmOptions,
) => Promise<AnswerLlmResult>

export function createDeepSeekLlm(params: DeepSeekParams): AnswerLlm {
  return async (messages, options) => {
    const merged: DeepSeekParams = options?.json
      ? { ...params, response_format: { type: 'json_object' } }
      : params
    const reply = await callCompletions(
      TIER_ENDPOINTS.medium,
      apiKeyFor('DEEPSEEK_API_KEY'),
      messages,
      merged,
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
