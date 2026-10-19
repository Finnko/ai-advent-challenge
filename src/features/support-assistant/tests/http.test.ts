import { describe, expect, it } from 'vitest'
import { SupportError } from '../domain/errors'
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '../server/http.server'

describe('support HTTP helpers', () => {
  it('adds no-store and security headers', () => {
    const response = jsonResponse({ ok: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('maps SupportError to JSON with Retry-After', async () => {
    const response = errorResponse(
      new SupportError('too_many_requests', 'Слишком много.', 429, 42),
    )
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('42')
    const body = (await response.json()) as {
      error: { code: string; retryAfterSec: number }
    }
    expect(body.error.code).toBe('too_many_requests')
    expect(body.error.retryAfterSec).toBe(42)
  })

  it('rejects oversized and malformed bodies', async () => {
    const big = new Request('http://support.local/api/support/ask', {
      method: 'POST',
      body: 'x'.repeat(64),
    })
    await expect(readJsonBody(big, 16)).rejects.toMatchObject({
      code: 'bad_request',
      status: 413,
    })
    const broken = new Request('http://support.local/api/support/ask', {
      method: 'POST',
      body: '{',
    })
    await expect(readJsonBody(broken, 100)).rejects.toMatchObject({
      code: 'bad_request',
      status: 400,
    })
  })
})
