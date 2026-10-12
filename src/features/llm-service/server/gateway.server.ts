import { randomUUID, timingSafeEqual } from 'node:crypto'
import type {
  ApiChatMessage,
  ChatCompletionsRequest,
  OpenAiChatChunk,
  OpenAiChatCompletion,
  OpenAiModelList,
} from '../domain/types'
import type { ServiceConfig } from './config.server'
import {
  estimateMessagesTokens,
  estimateTextTokens,
  type RateLimitReason,
  type RateLimiter,
  type Semaphore,
} from './policy.server'
import type { Upstream } from './upstream.server'
import type { UsageTracker } from './usage.server'

export type GatewayDeps = {
  config: ServiceConfig
  upstream: Upstream
  limiter: RateLimiter
  semaphore: Semaphore
  usage: UsageTracker
  chatHtml: string
  now?: () => number
  genId?: () => string
}

export type Gateway = {
  handle: (request: Request) => Promise<Response>
}

const API_ROLES = new Set(['system', 'user', 'assistant'])

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function errorResponse(
  status: number,
  message: string,
  type: string,
  code: string | null = null,
): Response {
  return jsonResponse({ error: { message, type, code } }, status)
}

function parseMessages(value: unknown): ApiChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }
  const messages: ApiChatMessage[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return null
    }
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (typeof role !== 'string' || !API_ROLES.has(role)) {
      return null
    }
    if (typeof content !== 'string') {
      return null
    }
    messages.push({ role: role as ApiChatMessage['role'], content })
  }
  return messages
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8')
  const b = Buffer.from(right, 'utf8')
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

function extractIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip')?.trim() || 'local'
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createGateway(deps: GatewayDeps): Gateway {
  const { config, upstream, limiter, semaphore, usage } = deps
  const now = deps.now ?? Date.now
  const genId = deps.genId ?? ((): string => `chatcmpl-${randomUUID()}`)

  function authenticate(request: Request): string | null {
    const header = request.headers.get('authorization')
    const bearer = header?.toLowerCase().startsWith('bearer ')
      ? header.slice('bearer '.length).trim()
      : null
    const apiKey = request.headers.get('x-api-key')?.trim() ?? null
    const queryKey =
      new URL(request.url).searchParams.get('key')?.trim() ?? null
    const provided = bearer || apiKey || queryKey
    if (!provided) {
      return null
    }
    const match = config.keys.find((key) => safeEqual(key.secret, provided))
    return match ? match.id : null
  }

  function clampTemperature(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return config.defaultTemperature
    }
    return Math.min(2, Math.max(0, value))
  }

  function clampMaxTokens(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return config.maxOutputTokens
    }
    return Math.min(config.maxOutputTokens, Math.floor(value))
  }

  function logUsage(input: {
    keyId: string
    ip: string
    ok: boolean
    status: number
    stream: boolean
    promptTokens: number
    completionTokens: number
    latencyMs: number
  }): void {
    usage.record({
      ts: new Date(now()).toISOString(),
      model: config.endpoint.model,
      ...input,
    })
  }

  function rateLimited(
    retryAfterSec: number,
    reason: RateLimitReason,
  ): Response {
    const response = errorResponse(
      429,
      `Превышен лимит (${reason}). Повтори через ${retryAfterSec} с.`,
      'rate_limit_error',
      'rate_limit_exceeded',
    )
    response.headers.set('Retry-After', String(retryAfterSec))
    return response
  }

  function handleHealth(): Promise<Response> {
    return upstream.status().then((status) =>
      jsonResponse({
        status: status.available ? 'ok' : 'degraded',
        upstream: {
          available: status.available,
          baseUrl: status.baseUrl,
          model: status.model,
          error: status.error,
        },
        limits: {
          rpm: config.rpm,
          tokensPerMin: config.tokensPerMin,
          ipRpm: config.ipRpm,
          maxInputTokens: config.maxInputTokens,
          maxOutputTokens: config.maxOutputTokens,
          queueDepth: config.queueDepth,
        },
        concurrency: semaphore.stats(),
      }),
    )
  }

  function handleModels(): Response {
    const body: OpenAiModelList = {
      object: 'list',
      data: [
        {
          id: config.endpoint.model,
          object: 'model',
          created: 0,
          owned_by: 'local',
        },
      ],
    }
    return jsonResponse(body)
  }

  function handleStats(): Response {
    return jsonResponse({
      keys: usage.snapshot(),
      concurrency: semaphore.stats(),
    })
  }

  async function handleNonStream(request: {
    keyId: string
    ip: string
    messages: ApiChatMessage[]
    params: { temperature: number; max_tokens: number }
    startedAt: number
    release: () => void
  }): Promise<Response> {
    try {
      const result = await upstream.chat(request.messages, request.params)
      const promptTokens =
        result.usage?.prompt_tokens ?? estimateMessagesTokens(request.messages)
      const completionTokens =
        result.usage?.completion_tokens ?? estimateTextTokens(result.content)
      limiter.charge(request.keyId, completionTokens)
      logUsage({
        keyId: request.keyId,
        ip: request.ip,
        ok: true,
        status: 200,
        stream: false,
        promptTokens,
        completionTokens,
        latencyMs: now() - request.startedAt,
      })
      const body: OpenAiChatCompletion = {
        id: genId(),
        object: 'chat.completion',
        created: Math.floor(now() / 1000),
        model: config.endpoint.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: result.content },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      }
      return jsonResponse(body)
    } catch (error) {
      logUsage({
        keyId: request.keyId,
        ip: request.ip,
        ok: false,
        status: 502,
        stream: false,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: now() - request.startedAt,
      })
      return errorResponse(
        502,
        `Апстрим недоступен: ${describeError(error)}`,
        'upstream_error',
        'upstream_unavailable',
      )
    } finally {
      request.release()
    }
  }

  function handleStream(request: {
    keyId: string
    ip: string
    messages: ApiChatMessage[]
    params: { temperature: number; max_tokens: number }
    startedAt: number
    release: () => void
  }): Response {
    const created = Math.floor(now() / 1000)
    const id = genId()
    const encoder = new TextEncoder()
    let promptTokens = estimateMessagesTokens(request.messages)
    let completionTokens = 0
    let content = ''
    let ok = true
    let status = 200

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (chunk: OpenAiChatChunk): void => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          )
        }
        const emit = (text: string, finish: 'stop' | null): void => {
          write({
            id,
            object: 'chat.completion.chunk',
            created,
            model: config.endpoint.model,
            choices: [
              {
                index: 0,
                delta: text ? { role: 'assistant', content: text } : {},
                finish_reason: finish,
              },
            ],
          })
        }

        try {
          for await (const chunk of upstream.stream(
            request.messages,
            request.params,
          )) {
            if (chunk.type === 'delta') {
              content += chunk.content
              emit(chunk.content, null)
              continue
            }
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens
              completionTokens = chunk.usage.completion_tokens
            }
          }
          if (completionTokens === 0) {
            completionTokens = estimateTextTokens(content)
          }
          limiter.charge(request.keyId, completionTokens)
          emit('', 'stop')
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (error) {
          ok = false
          status = 502
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: {
                  message: `Апстрим недоступен: ${describeError(error)}`,
                  type: 'upstream_error',
                  code: 'upstream_unavailable',
                },
              })}\n\n`,
            ),
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          logUsage({
            keyId: request.keyId,
            ip: request.ip,
            ok,
            status,
            stream: true,
            promptTokens,
            completionTokens,
            latencyMs: now() - request.startedAt,
          })
          request.release()
          controller.close()
        }
      },
    })

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  async function handleChat(
    request: Request,
    keyId: string,
  ): Promise<Response> {
    const ip = extractIp(request)
    let payload: ChatCompletionsRequest
    try {
      payload = (await request.json()) as ChatCompletionsRequest
    } catch {
      return errorResponse(
        400,
        'Тело запроса не является JSON.',
        'invalid_request_error',
        'invalid_json',
      )
    }

    const messages = parseMessages(payload.messages)
    if (!messages) {
      return errorResponse(
        400,
        'Поле messages должно быть непустым массивом {role, content}.',
        'invalid_request_error',
        'invalid_messages',
      )
    }

    const promptTokens = estimateMessagesTokens(messages)
    if (promptTokens > config.maxInputTokens) {
      return errorResponse(
        413,
        `Слишком длинный ввод: ${promptTokens} токенов > ${config.maxInputTokens}. Сократи историю.`,
        'invalid_request_error',
        'context_length_exceeded',
      )
    }

    const decision = limiter.admit(keyId, ip, promptTokens)
    if (!decision.allowed) {
      return rateLimited(decision.retryAfterSec, decision.reason)
    }

    const slot = await semaphore.acquire()
    if (!slot.ok) {
      return errorResponse(
        503,
        'Модель занята, очередь переполнена. Повтори позже.',
        'server_error',
        'model_overloaded',
      )
    }

    const args = {
      keyId,
      ip,
      messages,
      params: {
        temperature: clampTemperature(payload.temperature),
        max_tokens: clampMaxTokens(payload.max_tokens),
      },
      startedAt: now(),
      release: slot.slot.release,
    }

    if (payload.stream === true) {
      return handleStream(args)
    }
    return handleNonStream(args)
  }

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (
      request.method === 'GET' &&
      (pathname === '/' || pathname === '/chat' || pathname === '/index.html')
    ) {
      return new Response(deps.chatHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (request.method === 'GET' && pathname === '/health') {
      return handleHealth()
    }

    const keyId = authenticate(request)
    if (!keyId) {
      return errorResponse(
        401,
        'Нужен действующий ключ в Authorization: Bearer <key>.',
        'invalid_request_error',
        'invalid_api_key',
      )
    }

    if (request.method === 'GET' && pathname === '/stats') {
      return handleStats()
    }
    if (request.method === 'GET' && pathname === '/v1/models') {
      return handleModels()
    }
    if (request.method === 'POST' && pathname === '/v1/chat/completions') {
      return handleChat(request, keyId)
    }
    return errorResponse(
      404,
      `Неизвестный маршрут: ${pathname}`,
      'invalid_request_error',
      'not_found',
    )
  }

  return { handle }
}
