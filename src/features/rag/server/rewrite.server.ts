import {
  buildRewriteMessages,
  parseRewriteResponse,
  type Rewriter,
} from '../domain/rewrite-prompt'
import type { AnswerLlm } from './answer-llm.server'
import { createDeepSeekLlm } from './answer-llm.server'

export const REWRITE_MAX_TOKENS = 200

export function createLlmRewriter(
  llm: AnswerLlm = createDeepSeekLlm({
    temperature: 0,
    max_tokens: REWRITE_MAX_TOKENS,
    response_format: { type: 'json_object' },
  }),
): Rewriter {
  return async (question) => {
    try {
      const reply = await llm(buildRewriteMessages(question))
      return parseRewriteResponse(reply.content) ?? question
    } catch {
      return question
    }
  }
}

export function createDefaultRewriter(): Rewriter {
  return createLlmRewriter()
}
