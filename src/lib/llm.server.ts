import type {
  ChatResult,
  ChatUsage,
  CompletionEndpoint,
  DeepSeekParams,
} from './llm'

type DeepSeekResponse = {
  choices?: { message?: { content?: string } }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
  }
}

const ENV_HINTS: Record<string, string> = {
  DEEPSEEK_API_KEY: 'Скопируй .env.example в .env и впиши свой ключ.',
  HUGGING_FACE_TOKEN: 'Добавь HUGGING_FACE_TOKEN в .env (см. .env.example).',
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (value) {
    return value
  }
  throw new Error(`${name} не задан. ${ENV_HINTS[name] ?? 'Проверь .env.'}`)
}

export function apiKeyFor(name: string): string {
  return requireEnv(name)
}

export async function callCompletions(
  endpoint: CompletionEndpoint,
  apiKey: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  params: DeepSeekParams = {},
): Promise<ChatResult> {
  const startedAt = Date.now()

  const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      ...(endpoint.withThinking ? { thinking: { type: 'disabled' } } : {}),
      ...params,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ошибка API (${res.status}): ${body}`)
  }

  const dataJson = (await res.json()) as DeepSeekResponse

  const latencyMs = Date.now() - startedAt

  const content = dataJson.choices?.[0]?.message?.content ?? ''

  const rawUsage = dataJson.usage
  const usage: ChatUsage | null =
    typeof rawUsage?.prompt_tokens === 'number' &&
    typeof rawUsage?.completion_tokens === 'number'
      ? {
          prompt_tokens: rawUsage.prompt_tokens,
          completion_tokens: rawUsage.completion_tokens,
          ...(typeof rawUsage.prompt_cache_hit_tokens === 'number'
            ? { prompt_cache_hit_tokens: rawUsage.prompt_cache_hit_tokens }
            : {}),
          ...(typeof rawUsage.prompt_cache_miss_tokens === 'number'
            ? { prompt_cache_miss_tokens: rawUsage.prompt_cache_miss_tokens }
            : {}),
        }
      : null

  return {
    content,
    usage,
    model: endpoint.model,
    latencyMs,
  } satisfies ChatResult
}
