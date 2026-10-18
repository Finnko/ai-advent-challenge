import type { CallLLM } from '@lib/agent-loop/types'
import type { CompletionEndpoint } from '@lib/llm'
import { DEEPSEEK_ENDPOINT } from '@lib/llm'
import { apiKeyFor, callCompletions, requireEnv } from '@lib/llm.server'

function endpoint(): CompletionEndpoint {
  return { ...DEEPSEEK_ENDPOINT, model: requireEnv('DEEPSEEK_MODEL') }
}

export function createReviewLlm(): CallLLM {
  const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
  const target = endpoint()
  return async ({ messages, response_format, max_tokens, temperature }) => {
    const result = await callCompletions(target, apiKey, messages, {
      max_tokens,
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(response_format ? { response_format } : {}),
    })
    return {
      content: result.content,
      usage: result.usage,
      latencyMs: result.latencyMs ?? 0,
    }
  }
}
