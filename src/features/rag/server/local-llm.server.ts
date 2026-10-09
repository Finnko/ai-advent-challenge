import {
  getLocalLlmStatus,
  resolveLocalBaseUrl,
  runLocalChat,
} from '@lib/local-llm.server'
import type { CompletionEndpoint, LocalLlmStatus } from '@lib/llm'
import {
  ANSWER_MAX_TOKENS,
  ANSWER_TEMPERATURE,
  type AnswerLlm,
} from './answer-llm.server'

export const DEFAULT_RAG_LLM_MODEL = 'mlx-community/Qwen3-14B-4bit'

export function resolveRagModel(): string {
  return process.env.RAG_LLM_MODEL?.trim() || DEFAULT_RAG_LLM_MODEL
}

export function resolveRagEndpoint(): CompletionEndpoint {
  return {
    baseUrl: resolveLocalBaseUrl(),
    model: resolveRagModel(),
    withThinking: false,
  }
}

export function createLocalAnswerLlm(): AnswerLlm {
  return async (messages, options) => {
    const reply = await runLocalChat(
      messages,
      {
        temperature: ANSWER_TEMPERATURE,
        max_tokens: ANSWER_MAX_TOKENS,
        ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
      },
      { endpoint: resolveRagEndpoint() },
    )
    return {
      content: reply.content,
      usage: reply.usage,
      latencyMs: reply.latencyMs ?? 0,
      model: reply.model ?? resolveRagModel(),
    }
  }
}

export function getRagLlmStatus(): Promise<LocalLlmStatus> {
  return getLocalLlmStatus({ endpoint: resolveRagEndpoint() })
}
