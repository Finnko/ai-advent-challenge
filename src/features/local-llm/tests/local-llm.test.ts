import { describe, expect, it } from 'vitest'
import type { CompletionEndpoint } from '@lib/llm'
import { LOCAL_LLM_PRESETS } from '../data/presets'
import { resolveRunPrompt } from '../functions/validation'
import { getLocalLlmStatus, runLocalPrompt } from '../server/local-llm.server'

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

describe('runLocalPrompt', () => {
  it('возвращает ответ, usage и заголовок тела с отключённым thinking', async () => {
    const captured: { url: string; body: Record<string, unknown> }[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      captured.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      })
      return jsonResponse({
        choices: [{ message: { content: '408' } }],
        usage: { prompt_tokens: 27, completion_tokens: 4 },
      })
    }) as unknown as typeof fetch

    const answer = await runLocalPrompt('17 × 24?', {
      fetchImpl,
      endpoint: ENDPOINT,
    })

    expect(answer.content).toBe('408')
    expect(answer.model).toBe('test-model')
    expect(answer.usage?.completion_tokens).toBe(4)
    expect(answer.tokensPerSecond === null || answer.tokensPerSecond > 0).toBe(
      true,
    )
    expect(captured[0].url).toBe('http://127.0.0.1:8080/v1/chat/completions')
    expect(captured[0].body.model).toBe('test-model')
    expect(captured[0].body.chat_template_kwargs).toEqual({
      enable_thinking: false,
    })
  })
})

describe('getLocalLlmStatus', () => {
  it('доступна, когда /models отдаёт список', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        object: 'list',
        data: [{ id: 'test-model' }],
      })) as unknown as typeof fetch

    const status = await getLocalLlmStatus({ fetchImpl, endpoint: ENDPOINT })

    expect(status.available).toBe(true)
    expect(status.servedModels).toEqual(['test-model'])
    expect(status.error).toBeNull()
  })

  it('недоступна при сетевой ошибке', async () => {
    const fetchImpl = (async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8080')
    }) as unknown as typeof fetch

    const status = await getLocalLlmStatus({ fetchImpl, endpoint: ENDPOINT })

    expect(status.available).toBe(false)
    expect(status.error).toContain('ECONNREFUSED')
  })
})

describe('resolveRunPrompt', () => {
  it('превращает presetId в текст пресета', () => {
    expect(resolveRunPrompt({ presetId: 'simple' })).toBe(
      LOCAL_LLM_PRESETS[0].prompt,
    )
  })

  it('отклоняет неизвестный пресет', () => {
    expect(() => resolveRunPrompt({ presetId: 'nope' })).toThrow(
      'Неизвестный пресет',
    )
  })

  it('отклоняет пустой промпт', () => {
    expect(() => resolveRunPrompt({ prompt: '   ' })).toThrow(
      'Промпт обязателен',
    )
  })

  it('принимает свободный промпт', () => {
    expect(resolveRunPrompt({ prompt: '  привет  ' })).toBe('привет')
  })
})
