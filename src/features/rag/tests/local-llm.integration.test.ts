import { describe, expect, it } from 'vitest'
import {
  createLocalAnswerLlm,
  getRagLlmStatus,
} from '../server/local-llm.server'

const run = process.env.RUN_MODEL_TESTS === '1'

describe.skipIf(!run)('RAG local generator (real MLX server)', () => {
  it('reports the local RAG endpoint as available', async () => {
    const status = await getRagLlmStatus()
    expect(status.available).toBe(true)
  }, 30_000)

  it('generates an answer through the local model', async () => {
    const llm = createLocalAnswerLlm()
    const result = await llm(
      [
        {
          role: 'system',
          content:
            'Верни строго JSON без markdown: {"answer": "...", "quotes": []}. Отвечай по-русски.',
        },
        { role: 'user', content: 'Сколько будет 2 + 2? Ответь одним числом.' },
      ],
      { json: true },
    )

    expect(result.content.trim().length).toBeGreaterThan(0)
    expect(result.model).toBeTruthy()
    expect(result.usage).not.toBeNull()
  }, 180_000)
})
