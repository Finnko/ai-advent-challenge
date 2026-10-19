import { describe, expect, it } from 'vitest'
import {
  createSupportGate,
  createSupportLimiter,
  extractClientIp,
} from '../server/metrics.server'

const HOUR = 3_600_000
const START = Date.UTC(2026, 9, 17, 10, 0, 0)

describe('support limiter', () => {
  it('limits one IP to 30 per hour', () => {
    const limiter = createSupportLimiter({
      ipPerHour: 2,
      globalPerHour: 10,
      dailyMax: 10,
    })
    expect(limiter.admit('1.1.1.1', START).allowed).toBe(true)
    expect(limiter.admit('1.1.1.1', START + 1).allowed).toBe(true)
    const denied = limiter.admit('1.1.1.1', START + 2)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.scope).toBe('ip')
      expect(denied.retryAfterSec).toBeGreaterThan(0)
    }
    expect(limiter.admit('1.1.1.1', START + HOUR).allowed).toBe(true)
  })

  it('limits globally across IPs', () => {
    const limiter = createSupportLimiter({
      ipPerHour: 10,
      globalPerHour: 2,
      dailyMax: 10,
    })
    expect(limiter.admit('1.1.1.1', START).allowed).toBe(true)
    expect(limiter.admit('2.2.2.2', START).allowed).toBe(true)
    const denied = limiter.admit('3.3.3.3', START)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.scope).toBe('global')
    }
  })

  it('limits the day and resets at midnight', () => {
    const limiter = createSupportLimiter({
      ipPerHour: 10,
      globalPerHour: 10,
      dailyMax: 2,
    })
    expect(limiter.admit('1.1.1.1', START).allowed).toBe(true)
    expect(limiter.admit('2.2.2.2', START).allowed).toBe(true)
    const denied = limiter.admit('3.3.3.3', START)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.scope).toBe('daily')
    }
    expect(limiter.admit('1.1.1.1', START + 86_400_000).allowed).toBe(true)
  })
})

describe('client IP', () => {
  it('uses the first valid X-Forwarded-For value', () => {
    const request = new Request('http://support.local/api/support/ask', {
      headers: {
        'x-forwarded-for': '95.72.97.121, 100.64.0.1',
        'x-real-ip': '5.6.7.8',
      },
    })
    expect(extractClientIp(request)).toBe('95.72.97.121')
  })

  it('ignores X-Real-IP when X-Forwarded-For is absent', () => {
    const request = new Request('http://support.local/api/support/ask', {
      headers: { 'x-real-ip': '5.6.7.8' },
    })
    expect(extractClientIp(request)).toBe('unknown')
  })
})

describe('support gate', () => {
  it('queues one request and rejects the next', async () => {
    const gate = createSupportGate(1, 1, 100)
    const first = await gate.acquire()
    expect(first.ok).toBe(true)
    const second = gate.acquire()
    const third = await gate.acquire()
    expect(third.ok).toBe(false)
    if (first.ok) {
      first.slot.release()
    }
    const secondResult = await second
    expect(secondResult.ok).toBe(true)
    if (secondResult.ok) {
      secondResult.slot.release()
    }
  })
})
