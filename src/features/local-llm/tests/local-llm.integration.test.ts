import { describe, expect, it } from 'vitest'
import { getLocalLlmStatus, runLocalPrompt } from '../server/local-llm.server'

const runModelTests = process.env.RUN_MODEL_TESTS === '1'

describe.skipIf(!runModelTests)('local LLM (real MLX server)', () => {
  it('отвечает на простой запрос', async () => {
    const answer = await runLocalPrompt(
      'Сколько будет 2 + 2? Ответь одним числом.',
    )
    expect(answer.content.trim().length).toBeGreaterThan(0)
    expect(answer.usage).not.toBeNull()
  }, 120_000)

  it('сообщает, что сервер доступен', async () => {
    const status = await getLocalLlmStatus()
    expect(status.available).toBe(true)
  }, 30_000)
})
