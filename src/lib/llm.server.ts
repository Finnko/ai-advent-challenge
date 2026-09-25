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

function toChatUsage(rawUsage: DeepSeekResponse['usage']): ChatUsage | null {
  if (
    typeof rawUsage?.prompt_tokens !== 'number' ||
    typeof rawUsage.completion_tokens !== 'number'
  ) {
    return null
  }
  return {
    prompt_tokens: rawUsage.prompt_tokens,
    completion_tokens: rawUsage.completion_tokens,
    ...(typeof rawUsage.prompt_cache_hit_tokens === 'number'
      ? { prompt_cache_hit_tokens: rawUsage.prompt_cache_hit_tokens }
      : {}),
    ...(typeof rawUsage.prompt_cache_miss_tokens === 'number'
      ? { prompt_cache_miss_tokens: rawUsage.prompt_cache_miss_tokens }
      : {}),
  }
}

function describeCause(error: unknown): string {
  const cause = (error as { cause?: unknown })?.cause
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code
    return `${cause.name}${typeof code === 'string' ? `/${code}` : ''}: ${cause.message}`
  }
  return cause ? String(cause) : 'нет'
}

function describeFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const cause = describeCause(error)
  return cause === 'нет' ? message : `${message} (${cause})`
}

const DEFAULT_ATTEMPTS = 4
const DEFAULT_RETRY_DELAY_MS = 300

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

const RETRYABLE_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
])

export type CallCompletionsOptions = {
  attempts?: number
  baseDelayMs?: number
  fetchImpl?: typeof fetch
}

function causeCode(error: unknown): string | null {
  const cause = (error as { cause?: unknown })?.cause
  if (cause && typeof cause === 'object') {
    const code = (cause as { code?: unknown }).code
    if (typeof code === 'string') {
      return code
    }
  }
  return null
}

function isRetryableError(error: unknown): boolean {
  const code = causeCode(error)
  return code !== null && RETRYABLE_CODES.has(code)
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(baseDelayMs: number, retryIndex: number): number {
  return Math.round(baseDelayMs * 2 ** retryIndex + Math.random() * baseDelayMs)
}

export async function callCompletions(
  endpoint: CompletionEndpoint,
  apiKey: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  params: DeepSeekParams = {},
  options: CallCompletionsOptions = {},
): Promise<ChatResult> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const doFetch = options.fetchImpl ?? fetch

  const body = JSON.stringify({
    model: endpoint.model,
    messages,
    ...(endpoint.withThinking ? { thinking: { type: 'disabled' } } : {}),
    ...params,
  })

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const isLast = attempt === attempts - 1
    const startedAt = Date.now()

    let res: Response
    try {
      res = await doFetch(`${endpoint.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      })
    } catch (error) {
      console.error(
        `[DEBUG-llm] fetch failed attempt=${attempt + 1}/${attempts} model=${endpoint.model} messages=${messages.length} bytes=${body.length} after=${Date.now() - startedAt}ms cause=${describeCause(error)}`,
      )
      if (!isLast && isRetryableError(error)) {
        await sleep(retryDelayMs(baseDelayMs, attempt))
        continue
      }
      throw new Error(describeFetchError(error))
    }

    if (!res.ok) {
      const errorBody = await res.text()
      console.error(
        `[DEBUG-llm] http error attempt=${attempt + 1}/${attempts} status=${res.status} model=${endpoint.model} after=${Date.now() - startedAt}ms`,
      )
      if (!isLast && isRetryableStatus(res.status)) {
        await sleep(retryDelayMs(baseDelayMs, attempt))
        continue
      }
      throw new Error(`Ошибка API (${res.status}): ${errorBody}`)
    }

    const dataJson = (await res.json()) as DeepSeekResponse
    const content = dataJson.choices?.[0]?.message?.content ?? ''
    return {
      content,
      usage: toChatUsage(dataJson.usage),
      model: endpoint.model,
      latencyMs: Date.now() - startedAt,
    } satisfies ChatResult
  }

  throw new Error('Не удалось выполнить запрос к LLM.')
}
