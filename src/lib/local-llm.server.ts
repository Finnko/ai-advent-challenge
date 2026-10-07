import { callCompletions } from './llm.server'
import type {
  ChatMessage,
  ChatResult,
  CompletionEndpoint,
  DeepSeekParams,
  LocalLlmStatus,
} from './llm'

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

export async function runLocalChat(
  messages: ChatMessage[],
  params: DeepSeekParams = {},
  deps: LocalLlmDeps = {},
): Promise<ChatResult> {
  const endpoint = deps.endpoint ?? resolveLocalEndpoint()
  return callCompletions(
    endpoint,
    'local',
    messages,
    { max_tokens: LOCAL_MAX_TOKENS, temperature: LOCAL_TEMPERATURE, ...params },
    {
      fetchImpl: deps.fetchImpl,
      attempts: 2,
      baseDelayMs: 200,
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    },
  )
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
