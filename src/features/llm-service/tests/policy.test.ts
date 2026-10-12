import { describe, expect, it } from 'vitest'
import {
  createRateLimiter,
  createSemaphore,
  estimateMessagesTokens,
  estimateTextTokens,
} from '../server/policy.server'

function rig(overrides: Partial<Parameters<typeof createRateLimiter>[0]> = {}) {
  let clock = 0
  const limiter = createRateLimiter({
    rpm: 2,
    tokensPerMin: 1000,
    ipRpm: 10,
    now: () => clock,
    ...overrides,
  })
  return { limiter, advance: (ms: number) => (clock += ms) }
}

describe('estimateMessagesTokens', () => {
  it('считает токены и добавляет оверхед на сообщение', () => {
    const tokens = estimateMessagesTokens([{ role: 'user', content: 'привет' }])
    expect(tokens).toBeGreaterThan(estimateTextTokens('привет'))
  })
})

describe('createRateLimiter', () => {
  it('режет по rpm', () => {
    const { limiter } = rig()
    expect(limiter.admit('k', 'ip', 1).allowed).toBe(true)
    expect(limiter.admit('k', 'ip', 1).allowed).toBe(true)
    const denied = limiter.admit('k', 'ip', 1)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.reason).toBe('rpm')
      expect(denied.retryAfterSec).toBeGreaterThan(0)
    }
  })

  it('восстанавливает rpm после окна', () => {
    const { limiter, advance } = rig()
    limiter.admit('k', 'ip', 1)
    limiter.admit('k', 'ip', 1)
    expect(limiter.admit('k', 'ip', 1).allowed).toBe(false)
    advance(60_000)
    expect(limiter.admit('k', 'ip', 1).allowed).toBe(true)
  })

  it('режет по бюджету токенов', () => {
    const { limiter } = rig({ rpm: 100, tokensPerMin: 100, ipRpm: 100 })
    expect(limiter.admit('k', 'ip', 100).allowed).toBe(true)
    const denied = limiter.admit('k', 'ip', 1)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.reason).toBe('tokens')
    }
  })

  it('учитывает post-charge выходных токенов', () => {
    const { limiter } = rig({ rpm: 100, tokensPerMin: 100, ipRpm: 100 })
    limiter.admit('k', 'ip', 10)
    limiter.charge('k', 95)
    const denied = limiter.admit('k', 'ip', 10)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.reason).toBe('tokens')
    }
  })

  it('режет по ip сверх ключевого лимита', () => {
    const { limiter } = rig({ rpm: 100, tokensPerMin: 1000, ipRpm: 1 })
    expect(limiter.admit('k', '1.2.3.4', 1).allowed).toBe(true)
    const denied = limiter.admit('k', '1.2.3.4', 1)
    expect(denied.allowed).toBe(false)
    if (!denied.allowed) {
      expect(denied.reason).toBe('ip')
    }
    expect(limiter.admit('k', '5.6.7.8', 1).allowed).toBe(true)
  })
})

describe('createSemaphore', () => {
  it('пускает одного и ставит второго в очередь', async () => {
    const semaphore = createSemaphore(1, 1, 1000)
    const first = await semaphore.acquire()
    expect(first.ok).toBe(true)

    const pending = semaphore.acquire()
    const full = await semaphore.acquire()
    expect(full.ok).toBe(false)
    expect(semaphore.stats()).toEqual({ active: 1, queued: 1 })

    if (first.ok) {
      first.slot.release()
    }
    const second = await pending
    expect(second.ok).toBe(true)
    if (second.ok) {
      second.slot.release()
    }
    expect(semaphore.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('отдаёт отказ при ожидании дольше таймаута', async () => {
    const semaphore = createSemaphore(1, 1, 10)
    const first = await semaphore.acquire()
    const result = await semaphore.acquire()
    expect(result.ok).toBe(false)
    if (first.ok) {
      first.slot.release()
    }
  })
})
