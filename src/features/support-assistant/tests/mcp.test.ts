import { describe, expect, it } from 'vitest'
import { createMcpHost } from '@lib/mcp/client.server'
import { supportMcpRegistry } from '../server/mcp-registry.server'

const host = createMcpHost(supportMcpRegistry)

describe('support MCP server', () => {
  it('exposes seven read-only tools', async () => {
    const listed = await host.listTools()
    expect(listed.ok).toBe(true)
    if (!listed.ok) {
      return
    }
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      'get_finance',
      'get_posting',
      'get_product',
      'get_seller',
      'get_ticket',
      'list_postings',
      'list_tickets',
    ])
    expect(listed.tools.every((tool) => tool.mutating === false)).toBe(true)
  })

  it('returns structured finance data over the protocol', async () => {
    const result = await host.callToolOnServer('ozon', 'get_finance', {
      sellerId: 'seller_2087',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const finance = result.structured?.finance as
        { nextPayoutAmount?: number } | undefined
      expect(finance?.nextPayoutAmount).toBe(128400.5)
      expect(result.text).toContain('Ближайшая выплата')
    }
  })
})
