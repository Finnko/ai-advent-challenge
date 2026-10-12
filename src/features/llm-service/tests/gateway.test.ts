import { describe, expect, it } from 'vitest'
import type { ChatStreamChunk } from '@lib/llm.server'
import type { LocalLlmStatus } from '@lib/llm'
import { resolveServiceConfig } from '../server/config.server'
import { createGateway } from '../server/gateway.server'
import {
  createRateLimiter,
  createSemaphore,
  type RateLimiter,
  type Semaphore,
} from '../server/policy.server'
import { createUsageTracker, type UsageTracker } from '../server/usage.server'
import type { Upstream } from '../server/upstream.server'

const CONFIG = resolveServiceConfig({
  LLM_SERVICE_KEYS: 'anna:secret1',
  LLM_SERVICE_RPM: '100',
  LLM_SERVICE_TOKENS_PER_MIN: '100000',
  LLM_SERVICE_IP_RPM: '1000',
  LLM_SERVICE_MAX_INPUT_TOKENS: '100',
  LLM_SERVICE_MAX_OUTPUT_TOKENS: '50',
} as NodeJS.ProcessEnv)

const AVAILABLE: LocalLlmStatus = {
  available: true,
  baseUrl: 'http://local:8080/v1',
  model: 'test-model',
  servedModels: ['test-model'],
  error: null,
}

function fakeUpstream(overrides: Partial<Upstream> = {}): Upstream {
  return {
    chat: async () => ({
      content: 'привет',
      usage: { prompt_tokens: 5, completion_tokens: 2 },
      model: 'test-model',
      latencyMs: 1,
    }),
    stream: async function* (): AsyncGenerator<ChatStreamChunk, void, void> {
      yield { type: 'delta', content: 'при' }
      yield { type: 'delta', content: 'вет' }
      yield {
        type: 'done',
        usage: { prompt_tokens: 5, completion_tokens: 2 },
        model: 'test-model',
        latencyMs: 1,
      }
    },
    status: async () => AVAILABLE,
    ...overrides,
  }
}

function buildGateway(
  overrides: {
    upstream?: Partial<Upstream>
    limiter?: RateLimiter
    semaphore?: Semaphore
  } = {},
): { gateway: ReturnType<typeof createGateway>; usage: UsageTracker } {
  const usage = createUsageTracker({})
  const gateway = createGateway({
    config: CONFIG,
    upstream: fakeUpstream(overrides.upstream),
    limiter:
      overrides.limiter ??
      createRateLimiter({
        rpm: CONFIG.rpm,
        tokensPerMin: CONFIG.tokensPerMin,
        ipRpm: CONFIG.ipRpm,
      }),
    semaphore:
      overrides.semaphore ??
      createSemaphore(1, CONFIG.queueDepth, CONFIG.queueWaitMs),
    usage,
    chatHtml: '<html>ok</html>',
    now: () => 1_000_000,
    genId: () => 'gen-1',
  })
  return { gateway, usage }
}

function chatPost(body: unknown, key = 'secret1'): Request {
  return new Request('http://svc/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const USER_MESSAGE = { messages: [{ role: 'user', content: 'привет' }] }

describe('gateway auth and routes', () => {
  it('отдаёт /health без ключа', async () => {
    const { gateway } = buildGateway()
    const res = await gateway.handle(new Request('http://svc/health'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.upstream.available).toBe(true)
  })

  it('требует ключ для /v1/models', async () => {
    const { gateway } = buildGateway()
    const unauthorized = await gateway.handle(
      new Request('http://svc/v1/models'),
    )
    expect(unauthorized.status).toBe(401)

    const wrong = await gateway.handle(
      new Request('http://svc/v1/models', {
        headers: { Authorization: 'Bearer nope' },
      }),
    )
    expect(wrong.status).toBe(401)

    const ok = await gateway.handle(
      new Request('http://svc/v1/models', {
        headers: { Authorization: 'Bearer secret1' },
      }),
    )
    expect(ok.status).toBe(200)
    const body = await ok.json()
    expect(body.data[0].id).toBe(CONFIG.endpoint.model)
  })

  it('пускает ключ из query (?key=)', async () => {
    const { gateway } = buildGateway()
    const res = await gateway.handle(
      new Request('http://svc/v1/models?key=secret1'),
    )
    expect(res.status).toBe(200)
  })

  it('отдаёт чат-страницу и 404 на неизвестный маршрут', async () => {
    const { gateway } = buildGateway()
    const page = await gateway.handle(new Request('http://svc/chat'))
    expect(await page.text()).toContain('<html>ok</html>')

    const missing = await gateway.handle(
      new Request('http://svc/v1/nope', {
        headers: { Authorization: 'Bearer secret1' },
      }),
    )
    expect(missing.status).toBe(404)
  })
})

describe('gateway chat', () => {
  it('возвращает OpenAI-совместимый ответ', async () => {
    const { gateway, usage } = buildGateway()
    const res = await gateway.handle(chatPost(USER_MESSAGE))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.object).toBe('chat.completion')
    expect(body.choices[0].message.content).toBe('привет')
    expect(body.usage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
      total_tokens: 7,
    })
    expect(usage.snapshot()).toEqual([
      {
        keyId: 'anna',
        requests: 1,
        errors: 0,
        promptTokens: 5,
        completionTokens: 2,
      },
    ])
  })

  it('отклоняет пустой messages', async () => {
    const { gateway } = buildGateway()
    const res = await gateway.handle(chatPost({ messages: [] }))
    expect(res.status).toBe(400)
  })

  it('отклоняет слишком длинный ввод (413)', async () => {
    const { gateway } = buildGateway()
    const res = await gateway.handle(
      chatPost({ messages: [{ role: 'user', content: 'слово '.repeat(200) }] }),
    )
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error.code).toBe('context_length_exceeded')
  })

  it('режет по rate limit (429)', async () => {
    const { gateway } = buildGateway({
      limiter: createRateLimiter({ rpm: 1, tokensPerMin: 100000, ipRpm: 1000 }),
    })
    const first = await gateway.handle(chatPost(USER_MESSAGE))
    expect(first.status).toBe(200)

    const second = await gateway.handle(chatPost(USER_MESSAGE))
    expect(second.status).toBe(429)
    expect(second.headers.get('retry-after')).toBeTruthy()
  })

  it('отдаёт 503, когда очередь занята', async () => {
    const semaphore = createSemaphore(1, 0)
    const held = await semaphore.acquire()
    const { gateway } = buildGateway({ semaphore })
    const res = await gateway.handle(chatPost(USER_MESSAGE))
    expect(res.status).toBe(503)
    if (held.ok) {
      held.slot.release()
    }
  })

  it('отдаёт 502 при падении апстрима', async () => {
    const { gateway } = buildGateway({
      upstream: {
        chat: async () => {
          throw new Error('mlx down')
        },
      },
    })
    const res = await gateway.handle(chatPost(USER_MESSAGE))
    expect(res.status).toBe(502)
  })

  it('стримит SSE-чанки и [DONE]', async () => {
    const { gateway } = buildGateway()
    const res = await gateway.handle(
      chatPost({ ...USER_MESSAGE, stream: true }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.text()
    expect(text).toContain('"content":"при"')
    expect(text).toContain('"content":"вет"')
    expect(text).toContain('"finish_reason":"stop"')
    expect(text).toContain('data: [DONE]')
  })
})
