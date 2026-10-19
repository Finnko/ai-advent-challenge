import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createOzonSource } from '../mcp/ozon/source'
import { createOzonToolkit } from '../mcp/ozon/tools'
import { createSandbox } from '../mcp/ozon/sandbox'
import type { ToolResult } from '@lib/mcp/response'

const FIXTURES = fileURLToPath(new URL('../data/fixtures', import.meta.url))
const toolkit = createOzonToolkit(createOzonSource(FIXTURES))

function textOf(result: ToolResult): string {
  expect(result.ok).toBe(true)
  return result.ok ? result.text : result.text
}

describe('ozon MCP toolkit', () => {
  it('returns a seller with masked keys', async () => {
    const result = await toolkit.seller({ sellerId: 'seller_1042' })
    const text = textOf(result)
    expect(text).toContain('ИП Соколова')
    expect(text).toContain('•••• 7f2a')
    expect(text).toContain('заблокирован')
    expect(result.ok && result.structured?.seller).toBeTruthy()
  })

  it('lists and reads tickets', async () => {
    const list = await toolkit.listTickets({ sellerId: 'seller_1042' })
    expect(textOf(list)).toContain('ticket_501')
    expect(textOf(list)).toContain('ticket_502')
    const ticket = await toolkit.ticket({ ticketId: 'ticket_504' })
    expect(textOf(ticket)).toContain('Отклонили карточку')
    expect(ticket.ok && ticket.structured?.ticket).toBeTruthy()
  })

  it('returns postings, a linked posting, a product and finance', async () => {
    const list = await toolkit.listPostings({ sellerId: 'seller_1042' })
    expect(textOf(list)).toContain('posting_1042-1')
    const posting = await toolkit.posting({ postingNumber: 'posting_1042-1' })
    expect(textOf(posting)).toContain('ожидает упаковки')
    const product = await toolkit.product({ productId: 'product_3310-1' })
    expect(textOf(product)).toContain('Нет сертификата')
    const finance = await toolkit.finance({ sellerId: 'seller_2087' })
    expect(textOf(finance)).toContain('Ближайшая выплата')
    expect(finance.ok && finance.structured?.finance).toBeTruthy()
  })

  it('reports unknown ids', async () => {
    expect((await toolkit.seller({ sellerId: 'seller_x' })).ok).toBe(false)
    expect((await toolkit.ticket({ ticketId: 'ticket_x' })).ok).toBe(false)
    expect((await toolkit.posting({ postingNumber: 'posting_x' })).ok).toBe(
      false,
    )
  })

  it('keeps the sandbox inside the fixtures root', async () => {
    const sandbox = createSandbox(FIXTURES)
    await expect(sandbox.readJson('../sellers.json')).rejects.toThrow(
      'вне каталога',
    )
  })
})
