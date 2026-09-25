import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompletionEndpoint } from './llm'
import { callCompletions } from './llm.server'

const ENDPOINT: CompletionEndpoint = {
  baseUrl: 'https://example.test',
  model: 'test-model',
  withThinking: false,
}

const MESSAGES = [{ role: 'user' as const, content: 'привет' }]

type FetchStep = { error: unknown } | { status: number; payload?: unknown }

function jsonResponse(payload: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

function makeFetch(steps: FetchStep[]): {
  impl: typeof fetch
  calls: () => number
} {
  const state = { calls: 0 }
  const impl = (async () => {
    const step = steps[Math.min(state.calls, steps.length - 1)]
    state.calls += 1
    if (!step) {
      throw new Error('no fetch step')
    }
    if ('error' in step) {
      throw step.error
    }
    return jsonResponse(step.payload ?? {}, step.status)
  }) as unknown as typeof fetch
  return { impl, calls: () => state.calls }
}

function connectTimeout(): Error {
  const cause = Object.assign(new Error('Connect Timeout Error'), {
    code: 'UND_ERR_CONNECT_TIMEOUT',
  })
  return Object.assign(new TypeError('fetch failed'), { cause })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('callCompletions retry', () => {
  it('ретраит connect timeout и возвращает ответ', async () => {
    const { impl, calls } = makeFetch([
      { error: connectTimeout() },
      { error: connectTimeout() },
      {
        status: 200,
        payload: {
          choices: [{ message: { content: 'привет' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2 },
        },
      },
    ])

    const result = await callCompletions(
      ENDPOINT,
      'key',
      MESSAGES,
      {},
      { fetchImpl: impl, baseDelayMs: 0 },
    )

    expect(result.content).toBe('привет')
    expect(calls()).toBe(3)
  })

  it('ретраит 503', async () => {
    const { impl, calls } = makeFetch([
      { status: 503 },
      {
        status: 200,
        payload: { choices: [{ message: { content: 'ok' } }] },
      },
    ])

    const result = await callCompletions(
      ENDPOINT,
      'key',
      MESSAGES,
      {},
      { fetchImpl: impl, baseDelayMs: 0 },
    )

    expect(result.content).toBe('ok')
    expect(calls()).toBe(2)
  })

  it('не ретраит 400', async () => {
    const { impl, calls } = makeFetch([
      { status: 400, payload: { error: 'bad request' } },
    ])

    await expect(
      callCompletions(ENDPOINT, 'key', MESSAGES, {}, { fetchImpl: impl, baseDelayMs: 0 }),
    ).rejects.toThrow('Ошибка API (400)')
    expect(calls()).toBe(1)
  })

  it('исчерпывает попытки и сообщает cause', async () => {
    const { impl, calls } = makeFetch([{ error: connectTimeout() }])

    await expect(
      callCompletions(ENDPOINT, 'key', MESSAGES, {}, {
        fetchImpl: impl,
        attempts: 3,
        baseDelayMs: 0,
      }),
    ).rejects.toThrow(/UND_ERR_CONNECT_TIMEOUT/)
    expect(calls()).toBe(3)
  })

  it('не ретраит невосстановимую сетевую ошибку без кода', async () => {
    const { impl, calls } = makeFetch([{ error: new TypeError('fetch failed') }])

    await expect(
      callCompletions(ENDPOINT, 'key', MESSAGES, {}, { fetchImpl: impl, baseDelayMs: 0 }),
    ).rejects.toThrow('fetch failed')
    expect(calls()).toBe(1)
  })
})
