import { describe, expect, it } from 'vitest'
import type { CompletionEndpoint } from '@lib/llm'
import { SWEEP_CONFIGS } from '../data/configs'
import { runExtraction } from '../server/run.server'

const ENDPOINT: CompletionEndpoint = {
  baseUrl: 'http://127.0.0.1:8080/v1',
  model: 'test-model',
  withThinking: false,
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

describe('runExtraction', () => {
  it('прогоняет модель, парсит ответ и оценивает поля', async () => {
    const captured: Record<string, unknown>[] = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return jsonResponse({
        choices: [
          {
            message: {
              content:
                '{"founded_year": 1147, "area_km2": 2561.5, "federal_district": "Центральный"}',
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      })
    }) as unknown as typeof fetch

    const run = await runExtraction(SWEEP_CONFIGS[0], 'moscow', 0, {
      fetchImpl,
      endpoint: ENDPOINT,
      sampleRss: () => 8192,
      now: () => new Date('2026-10-09T00:00:00.000Z'),
    })

    expect(run.model).toBe('test-model')
    expect(run.format).toBe('json')
    expect(run.valid).toBe(true)
    expect(run.score).toBe(1)
    expect(run.memBeforeMb).toBe(8192)
    expect(run.memAfterMb).toBe(8192)
    expect(run.createdAt).toBe('2026-10-09T00:00:00.000Z')
    expect(run.tokensPerSecond === null || run.tokensPerSecond > 0).toBe(true)
    expect(captured[0].response_format).toEqual({ type: 'json_object' })
    expect(captured[0].temperature).toBe(0)
    expect(captured[0].chat_template_kwargs).toEqual({
      enable_thinking: false,
    })
  })

  it('не отправляет response_format при выключенном JSON-режиме', async () => {
    const captured: Record<string, unknown>[] = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return jsonResponse({
        choices: [{ message: { content: 'нет данных' } }],
        usage: { prompt_tokens: 100, completion_tokens: 5 },
      })
    }) as unknown as typeof fetch

    const jsonOff = SWEEP_CONFIGS.find((config) => config.axis === 'json')
    if (!jsonOff) {
      throw new Error('нет конфигурации json')
    }

    const run = await runExtraction(jsonOff, 'kazan', 0, {
      fetchImpl,
      endpoint: ENDPOINT,
      sampleRss: () => null,
    })

    expect(run.format).toBe('text')
    expect(run.valid).toBe(false)
    expect(captured[0].response_format).toBeUndefined()
  })

  it('падает на неизвестном документе', async () => {
    await expect(
      runExtraction(SWEEP_CONFIGS[0], 'atlantis', 0, {
        endpoint: ENDPOINT,
        sampleRss: () => null,
      }),
    ).rejects.toThrow('Неизвестный документ')
  })
})
