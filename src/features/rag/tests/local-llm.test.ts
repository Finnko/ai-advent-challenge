import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalAnswerLlm,
  DEFAULT_RAG_LLM_MODEL,
  getRagLlmStatus,
  resolveRagModel,
} from '../server/local-llm.server'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return handler(String(url), init)
  })
  return calls
}

describe('resolveRagModel', () => {
  it('falls back to the 14B default', () => {
    vi.stubEnv('RAG_LLM_MODEL', '')
    expect(resolveRagModel()).toBe(DEFAULT_RAG_LLM_MODEL)
  })

  it('reads RAG_LLM_MODEL from the environment', () => {
    vi.stubEnv('RAG_LLM_MODEL', 'mlx-community/custom-model')
    expect(resolveRagModel()).toBe('mlx-community/custom-model')
  })
})

describe('createLocalAnswerLlm', () => {
  it('calls the local endpoint with the RAG model and JSON mode', async () => {
    vi.stubEnv('RAG_LLM_MODEL', 'mlx-community/test-14b')
    vi.stubEnv('LOCAL_LLM_BASE_URL', 'http://local.test/v1')
    const calls = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"answer":"ok","quotes":[]}' } }],
            usage: { prompt_tokens: 5, completion_tokens: 7 },
          }),
          { status: 200 },
        ),
    )

    const llm = createLocalAnswerLlm()
    const result = await llm(
      [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'question' },
      ],
      { json: true },
    )

    expect(result.content).toBe('{"answer":"ok","quotes":[]}')
    expect(result.usage).toEqual({ prompt_tokens: 5, completion_tokens: 7 })
    expect(result.model).toBe('mlx-community/test-14b')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://local.test/v1/chat/completions')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.model).toBe('mlx-community/test-14b')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it('omits response_format when not in JSON mode', async () => {
    const calls = stubFetch(
      () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'plain' } }] }),
          { status: 200 },
        ),
    )

    const llm = createLocalAnswerLlm()
    await llm([{ role: 'user', content: 'question' }])

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.response_format).toBeUndefined()
  })
})

describe('getRagLlmStatus', () => {
  it('reports the served models from the local endpoint', async () => {
    vi.stubEnv('RAG_LLM_MODEL', 'mlx-community/test-14b')
    vi.stubEnv('LOCAL_LLM_BASE_URL', 'http://local.test/v1')
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ data: [{ id: 'mlx-community/test-14b' }] }),
          { status: 200 },
        ),
    )

    const status = await getRagLlmStatus()

    expect(status.available).toBe(true)
    expect(status.model).toBe('mlx-community/test-14b')
    expect(status.servedModels).toEqual(['mlx-community/test-14b'])
    expect(status.error).toBeNull()
  })

  it('degrades to unavailable when the server is down', async () => {
    vi.stubEnv('RAG_LLM_MODEL', 'mlx-community/test-14b')
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED')
    })

    const status = await getRagLlmStatus()

    expect(status.available).toBe(false)
    expect(status.servedModels).toEqual([])
    expect(status.error).toContain('ECONNREFUSED')
  })
})
