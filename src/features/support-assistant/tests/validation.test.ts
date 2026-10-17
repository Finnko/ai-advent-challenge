import { describe, expect, it } from 'vitest'
import { parseAskRequest } from '../domain/validation'
import { isSupportPublicPath } from '../domain/public-route'

describe('support request validation', () => {
  it('accepts a valid request', () => {
    const parsed = parseAskRequest({
      sellerId: 'seller_1042',
      ticketId: 'ticket_501',
      question: '  Почему не работает вход?  ',
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.question).toBe('Почему не работает вход?')
    }
  })

  it('rejects short and malformed ids', () => {
    expect(
      parseAskRequest({
        sellerId: '../etc',
        ticketId: 'ticket_501',
        question: 'вопрос',
      }).ok,
    ).toBe(false)
    expect(
      parseAskRequest({
        sellerId: 'seller_1042',
        ticketId: 'x',
        question: 'вопрос',
      }).ok,
    ).toBe(false)
  })

  it('rejects empty and oversized questions', () => {
    expect(
      parseAskRequest({
        sellerId: 'seller_1042',
        ticketId: 'ticket_501',
        question: '   ',
      }).ok,
    ).toBe(false)
    expect(
      parseAskRequest({
        sellerId: 'seller_1042',
        ticketId: 'ticket_501',
        question: 'а'.repeat(801),
      }).ok,
    ).toBe(false)
  })
})

describe('support public allowlist', () => {
  it('allows the page, assets and the three API routes', () => {
    expect(isSupportPublicPath('/support')).toBe(true)
    expect(isSupportPublicPath('/support/')).toBe(true)
    expect(isSupportPublicPath('/assets/support-abc.js')).toBe(true)
    expect(isSupportPublicPath('/api/support/ask')).toBe(true)
    expect(isSupportPublicPath('/api/support/sellers')).toBe(true)
    expect(isSupportPublicPath('/api/support/health')).toBe(true)
    expect(isSupportPublicPath('/favicon.ico')).toBe(true)
  })

  it('blocks the rest of the application', () => {
    expect(isSupportPublicPath('/')).toBe(false)
    expect(isSupportPublicPath('/agent')).toBe(false)
    expect(isSupportPublicPath('/api/support/delete')).toBe(false)
    expect(isSupportPublicPath('/assets/../agent')).toBe(false)
    expect(isSupportPublicPath('/api/other')).toBe(false)
  })
})
