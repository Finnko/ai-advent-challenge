import { callCompletions } from '@lib/llm.server'
import type { ChatUsage, CompletionEndpoint } from '@lib/llm'
import type { LocalLlmAnswer, LocalLlmStatus } from '../types'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1'
const DEFAULT_MODEL = 'mlx-community/Qwen3-8B-4bit'

export const LOCAL_MAX_TOKENS = 768
export const LOCAL_TEMPERATURE = 0

export function resolveLocalBaseUrl(): string {
  return process.env.LOCAL_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL
}

export function resolveLocalModel(): string {
  return process.env.LOCAL_LLM_MODEL?.trim() || DEFAULT_MODEL
}

export function resolveLocalEndpoint(): CompletionEndpoint {
  return {
    baseUrl: resolveLocalBaseUrl(),
    model: resolveLocalModel(),
    withThinking: false,
  }
}

export type LocalLlmDeps = {
  fetchImpl?: typeof fetch
  endpoint?: CompletionEndpoint
}

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
  const endpoint = deps.endpoint ?? resolveLocalEndpoint()
  const result = await callCompletions(
    endpoint,
    'local',
    [{ role: 'user', content: prompt }],
    { max_tokens: LOCAL_MAX_TOKENS, temperature: LOCAL_TEMPERATURE },
    {
      fetchImpl: deps.fetchImpl,
      attempts: 2,
      baseDelayMs: 200,
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    },
  )

  const latencyMs = result.latencyMs ?? 0
  return {
    prompt,
    content: result.content,
    model: result.model ?? endpoint.model,
    usage: result.usage,
    latencyMs,
    tokensPerSecond: computeTokensPerSecond(result.usage, latencyMs),
  }
}

function extractModelIds(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) {
    return []
  }
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) {
    return []
  }
  return data
    .map((entry) =>
      typeof entry === 'object' && entry !== null
        ? (entry as { id?: unknown }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string')
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function getLocalLlmStatus(
  deps: LocalLlmDeps = {},
): Promise<LocalLlmStatus> {
  const endpoint = deps.endpoint ?? resolveLocalEndpoint()
  const doFetch = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await doFetch(`${endpoint.baseUrl}/models`, {
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        available: false,
        baseUrl: endpoint.baseUrl,
        model: endpoint.model,
        servedModels: [],
        error: `Локальный сервер ответил HTTP ${res.status}`,
      }
    }
    const payload = await res.json().catch(() => null)
    return {
      available: true,
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      servedModels: extractModelIds(payload),
      error: null,
    }
  } catch (error) {
    return {
      available: false,
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
      servedModels: [],
      error: describeError(error),
    }
  } finally {
    clearTimeout(timer)
  }
}
