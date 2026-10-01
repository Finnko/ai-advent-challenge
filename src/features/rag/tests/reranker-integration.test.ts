import { describe, expect, it } from 'vitest'
import { createLocalReranker } from '../server/reranker.server'

const run = process.env.RUN_MODEL_TESTS === '1'

describe.skipIf(!run)('reranker (real model)', () => {
  it('scores a relevant passage above an irrelevant one', async () => {
    const reranker = createLocalReranker()
    const [relevant, irrelevant] = await reranker.rerank({
      query: 'Какой город основал Пётр I в 1703 году?',
      documents: [
        'Санкт-Петербург был основан в 1703 году Петром I.',
        'Москва — столица России, крупнейший город страны.',
      ],
    })
    expect(relevant).toBeGreaterThan(irrelevant)
    expect(relevant).toBeGreaterThan(0.5)
  }, 600_000)
})
