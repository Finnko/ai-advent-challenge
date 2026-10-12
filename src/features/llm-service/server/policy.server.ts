import { countTokens } from 'gpt-tokenizer'
import type { ApiChatMessage } from '../domain/types'

export const MESSAGE_OVERHEAD_TOKENS = 4
export const DEFAULT_SEMAPHORE_WAIT_MS = 15_000

export function estimateMessagesTokens(messages: ApiChatMessage[]): number {
  return messages.reduce(
    (sum, message) =>
      sum + countTokens(message.content) + MESSAGE_OVERHEAD_TOKENS,
    0,
  )
}

export function estimateTextTokens(text: string): number {
  return countTokens(text)
}

type Bucket = {
  tokens: number
  updatedAt: number
}

export type RateLimitReason = 'rpm' | 'tokens' | 'ip'

export type RateDecision =
  | { allowed: true }
  | { allowed: false; reason: RateLimitReason; retryAfterSec: number }

export type RateLimiterOptions = {
  rpm: number
  tokensPerMin: number
  ipRpm: number
  now?: () => number
}

export type RateLimiter = {
  admit: (keyId: string, ip: string, tokens: number) => RateDecision
  charge: (keyId: string, tokens: number) => void
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now
  const keyBuckets = new Map<string, { requests: Bucket; tokens: Bucket }>()
  const ipBuckets = new Map<string, Bucket>()

  function bucket(initial: number, nowMs: number): Bucket {
    return { tokens: initial, updatedAt: nowMs }
  }

  function refill(target: Bucket, capacity: number, windowMs: number): void {
    const nowMs = now()
    const elapsed = Math.max(0, nowMs - target.updatedAt)
    target.tokens = Math.min(
      capacity,
      target.tokens + (elapsed / windowMs) * capacity,
    )
    target.updatedAt = nowMs
  }

  function retryAfter(
    target: Bucket,
    capacity: number,
    windowMs: number,
    needed: number,
  ): number {
    const deficit = needed - target.tokens
    if (deficit <= 0) {
      return 0
    }
    const tokensPerMs = capacity / windowMs
    return Math.max(1, Math.ceil(deficit / tokensPerMs / 1000))
  }

  function keyBucket(keyId: string): { requests: Bucket; tokens: Bucket } {
    const existing = keyBuckets.get(keyId)
    if (existing) {
      return existing
    }
    const nowMs = now()
    const created = {
      requests: bucket(options.rpm, nowMs),
      tokens: bucket(options.tokensPerMin, nowMs),
    }
    keyBuckets.set(keyId, created)
    return created
  }

  function ipBucket(ip: string): Bucket {
    const existing = ipBuckets.get(ip)
    if (existing) {
      return existing
    }
    const created = bucket(options.ipRpm, now())
    ipBuckets.set(ip, created)
    return created
  }

  return {
    admit(keyId, ip, tokens) {
      const buckets = keyBucket(keyId)
      const ipBucketState = ipBucket(ip)
      refill(buckets.requests, options.rpm, 60_000)
      refill(buckets.tokens, options.tokensPerMin, 60_000)
      refill(ipBucketState, options.ipRpm, 60_000)

      if (buckets.requests.tokens < 1) {
        return {
          allowed: false,
          reason: 'rpm',
          retryAfterSec: retryAfter(buckets.requests, options.rpm, 60_000, 1),
        }
      }
      if (ipBucketState.tokens < 1) {
        return {
          allowed: false,
          reason: 'ip',
          retryAfterSec: retryAfter(ipBucketState, options.ipRpm, 60_000, 1),
        }
      }
      if (buckets.tokens.tokens < tokens) {
        return {
          allowed: false,
          reason: 'tokens',
          retryAfterSec: retryAfter(
            buckets.tokens,
            options.tokensPerMin,
            60_000,
            tokens,
          ),
        }
      }

      buckets.requests.tokens -= 1
      ipBucketState.tokens -= 1
      buckets.tokens.tokens -= tokens
      return { allowed: true }
    },
    charge(keyId, tokens) {
      if (tokens <= 0) {
        return
      }
      const buckets = keyBucket(keyId)
      refill(buckets.tokens, options.tokensPerMin, 60_000)
      buckets.tokens.tokens -= tokens
    },
  }
}

export type Slot = {
  release: () => void
}

export type AcquireResult = { ok: true; slot: Slot } | { ok: false }

export type Semaphore = {
  acquire: () => Promise<AcquireResult>
  stats: () => { active: number; queued: number }
}

export function createSemaphore(
  limit: number,
  maxQueue: number,
  waitTimeoutMs: number = DEFAULT_SEMAPHORE_WAIT_MS,
): Semaphore {
  let active = 0
  const queue: (() => void)[] = []

  function release(): void {
    const next = queue.shift()
    if (next) {
      next()
      return
    }
    active = Math.max(0, active - 1)
  }

  function acquire(): Promise<AcquireResult> {
    if (active < limit) {
      active += 1
      return Promise.resolve({ ok: true, slot: { release } })
    }
    if (queue.length >= maxQueue) {
      return Promise.resolve({ ok: false })
    }
    return new Promise<AcquireResult>((resolve) => {
      let settled = false
      const grant = (): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        resolve({ ok: true, slot: { release } })
      }
      const timer = setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        const index = queue.indexOf(grant)
        if (index >= 0) {
          queue.splice(index, 1)
        }
        resolve({ ok: false })
      }, waitTimeoutMs)
      queue.push(grant)
    })
  }

  return { acquire, stats: () => ({ active, queued: queue.length }) }
}
