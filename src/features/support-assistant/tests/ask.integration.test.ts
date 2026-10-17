import { describe, expect, it } from 'vitest'
import { askSupport } from '../server/ask.server'

const enabled = process.env.RUN_MODEL_TESTS === '1'

describe.skipIf(!enabled)('support model integration', () => {
  it('answers with docs and ticket context', async () => {
    const result = await askSupport({
      sellerId: 'seller_1042',
      ticketId: 'ticket_502',
      question: 'Почему не приходят заказы и что делать со сроком сборки?',
    })
    expect(result.answer).toContain('По документации')
    expect(result.contextUsed).toBe(true)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.trace.map((call) => call.name)).toContain('get_ticket')
  }, 120_000)
})
