import { resolveLocalModel, runLocalChat } from '@lib/local-llm.server'
import type { LocalLlmDeps } from '@lib/local-llm.server'
import type { ChatUsage } from '@lib/llm'
import type { LocalLlmAnswer } from '../types'

export {
  LOCAL_MAX_TOKENS,
  LOCAL_TEMPERATURE,
  resolveLocalBaseUrl,
  resolveLocalEndpoint,
  resolveLocalModel,
  getLocalLlmStatus,
} from '@lib/local-llm.server'
export type { LocalLlmDeps } from '@lib/local-llm.server'

export type { LocalLlmStatus } from '@lib/llm'

function computeTokensPerSecond(
  usage: ChatUsage | null,
  latencyMs: number,
): number | null {
  if (!usage || usage.completion_tokens <= 0 || latencyMs <= 0) {
    return null
  }
  return Math.round((usage.completion_tokens / (latencyMs / 1000)) * 10) / 10
}

export async function runLocalPrompt(
  prompt: string,
  deps: LocalLlmDeps = {},
): Promise<LocalLlmAnswer> {
  const result = await runLocalChat(
    [{ role: 'user', content: prompt }],
    {},
    deps,
  )

  const latencyMs = result.latencyMs ?? 0
  return {
    prompt,
    content: result.content,
    model: result.model ?? deps.endpoint?.model ?? resolveLocalModel(),
    usage: result.usage,
    latencyMs,
    tokensPerSecond: computeTokensPerSecond(result.usage, latencyMs),
  }
}
