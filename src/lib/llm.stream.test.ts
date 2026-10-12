import { describe, expect, it } from 'vitest'
import type { CompletionEndpoint } from './llm'
import { streamCompletions, type ChatStreamChunk } from './llm.server'

const ENDPOINT: CompletionEndpoint = {
  baseUrl: 'https://example.test',
  model: 'test-model',
  withThinking: false,
}

const MESSAGES = [{ role: 'user' as const, content: 'привет' }]

function sseFetch(chunks: string[]): typeof fetch {
  return (async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
    return {
      ok: true,
      status: 200,
      body,
      text: async () => '',
    } as unknown as Response
  }) as unknown as typeof fetch
}

async function collect(chunks: string[]): Promise<ChatStreamChunk[]> {
  const collected: ChatStreamChunk[] = []
  for await (const chunk of streamCompletions(
    ENDPOINT,
    'key',
    MESSAGES,
    {},
    { fetchImpl: sseFetch(chunks), baseDelayMs: 0 },
  )) {
    collected.push(chunk)
  }
  return collected
}

function deltas(chunks: ChatStreamChunk[]): string {
  return chunks
    .filter((chunk) => chunk.type === 'delta')
    .map((chunk) => chunk.content)
    .join('')
}

describe('streamCompletions', () => {
  it('собирает дельты и финальный usage', async () => {
    const chunks = await collect([
      'data: {"choices":[{"delta":{"content":"при"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"вет"}}]}\n\n',
      'data: {"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ])

    expect(deltas(chunks)).toBe('привет')
    const done = chunks.at(-1)
    expect(done?.type).toBe('done')
    if (done?.type === 'done') {
      expect(done.usage).toEqual({ prompt_tokens: 3, completion_tokens: 2 })
      expect(done.model).toBe('test-model')
    }
  })

  it('склеивает разорванные по чанкам SSE-строки', async () => {
    const chunks = await collect([
      'data: {"choices":[{"delta":{"content":"пр',
      'ивет"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n',
      '\ndata: [DONE]\n\n',
    ])

    expect(deltas(chunks)).toBe('привет!')
  })

  it('переживает [DONE] без usage и мусорные строки', async () => {
    const chunks = await collect([
      ': keep-alive\n\n',
      'data: not-json\n\n',
      'data: {"choices":[{"delta":{"content":"ок"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    expect(deltas(chunks)).toBe('ок')
    const done = chunks.at(-1)
    if (done?.type === 'done') {
      expect(done.usage).toBeNull()
    }
  })
})
