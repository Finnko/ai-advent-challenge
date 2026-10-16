import type { CallLLM } from '@lib/agent-loop/types'
import { resolveAnswerLlm } from '@lib/rag-engine.server'
import type { AnswerGenerator } from '@lib/rag-engine.types'

export function resolveFileAssistantLlm(generator: AnswerGenerator): CallLLM {
  const llm = resolveAnswerLlm(generator)
  return async ({ messages, response_format, max_tokens }) => {
    const reply = await llm(
      messages.map((message) =>
        message.role === 'assistant'
          ? { role: 'user' as const, content: message.content }
          : { role: message.role, content: message.content },
      ),
      {
        json: Boolean(response_format),
        maxTokens: max_tokens,
      },
    )
    return {
      content: reply.content,
      usage: reply.usage,
      latencyMs: reply.latencyMs,
    }
  }
}

export type { AnswerGenerator }
