import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createOzonSource } from '../mcp/ozon/source'
import { buildTicketContext } from '../domain/ticket-context'
import {
  formatFinance,
  formatSeller,
  formatStatus,
} from '../domain/ticket-prompt'

const FIXTURES = fileURLToPath(new URL('../data/fixtures', import.meta.url))

describe('support ticket context', () => {
  const source = createOzonSource(FIXTURES)

  it('masks API keys in the seller block', async () => {
    const seller = await source.seller('seller_1042')
    expect(seller).not.toBeNull()
    const text = formatSeller(seller!)
    expect(text).toContain('•••• 7f2a')
    expect(text).not.toContain('7f2a-')
  })

  it('includes finance, ticket and postings', async () => {
    const [seller, ticket, finance] = await Promise.all([
      source.seller('seller_1042'),
      source.ticket('ticket_502'),
      source.finance('seller_1042'),
    ])
    const postings = await source.postingsBySeller('seller_1042')
    const blocks = buildTicketContext({
      seller,
      ticket,
      finance,
      postings,
      product: null,
    })
    const text = blocks.join('\n\n')
    expect(text).toContain('Тикет:')
    expect(text).toContain('posting_1042-1')
    expect(text).toContain('ожидает упаковки')
    expect(text).toContain('На удержании')
  })

  it('skips missing parts and respects the budget', async () => {
    const seller = await source.seller('seller_2087')
    const blocks = buildTicketContext({
      seller,
      ticket: null,
      finance: null,
      postings: [],
      product: null,
      maxChars: 120,
    })
    expect(blocks).toHaveLength(1)
    expect(blocks[0].length).toBeLessThanOrEqual(120)
  })

  it('formats finance and status labels', async () => {
    const finance = await source.finance('seller_2087')
    expect(finance).not.toBeNull()
    const text = formatFinance(finance!)
    expect(text).toContain('Ближайшая выплата')
    expect(text).toContain('128')
    expect(formatStatus('awaiting_packaging')).toBe('ожидает упаковки')
  })
})
