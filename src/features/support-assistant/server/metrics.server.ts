import { isIP } from 'node:net'
import { supportConfig } from './config.server'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MAX_TRACKED_IPS = 10_000

export type LimitScope = 'ip' | 'global' | 'daily'
export type LimitDecision =
  | { allowed: true }
  | { allowed: false; scope: LimitScope; retryAfterSec: number }

type Window = {
  start: number
  count: number
}

function freshWindow(now: number): Window {
  return { start: now, count: 0 }
}

function windowStart(now: number, size: number): number {
  return Math.floor(now / size) * size
}

export type SupportLimiterOptions = {
  ipPerHour: number
  globalPerHour: number
  dailyMax: number
  now?: () => number
}

export type SupportLimiter = {
  admit: (ip: string, at?: number) => LimitDecision
  stats: () => {
    ipBuckets: number
    global: number
    daily: number
  }
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) {
    return 'unknown'
  }
  const first = forwarded.split(',')[0]?.trim() ?? ''
  return isIP(first) === 0 ? 'unknown' : first
}

export function createSupportLimiter(
  options: SupportLimiterOptions,
): SupportLimiter {
  const now = options.now ?? Date.now
  const ipBuckets = new Map<string, Window>()
  let global: Window = freshWindow(now())
  let daily: Window = freshWindow(now())

  function current(ip: string, at: number): Window {
    const existing = ipBuckets.get(ip)
    if (!existing || at - existing.start >= HOUR_MS) {
      const created = { start: windowStart(at, HOUR_MS), count: 0 }
      ipBuckets.set(ip, created)
      return created
    }
    return existing
  }

  function resetGlobal(at: number): void {
    const start = windowStart(at, HOUR_MS)
    if (global.start !== start) {
      global = { start, count: 0 }
    }
  }

  function resetDaily(at: number): void {
    const start = windowStart(at, DAY_MS)
    if (daily.start !== start) {
      daily = { start, count: 0 }
    }
  }

  function retry(at: number, start: number, size: number): number {
    return Math.max(1, Math.ceil((start + size - at) / 1000))
  }

  return {
    admit(ip, at = now()) {
      resetGlobal(at)
      resetDaily(at)
      if (daily.count >= options.dailyMax) {
        return {
          allowed: false,
          scope: 'daily',
          retryAfterSec: retry(at, daily.start, DAY_MS),
        }
      }
      if (global.count >= options.globalPerHour) {
        return {
          allowed: false,
          scope: 'global',
          retryAfterSec: retry(at, global.start, HOUR_MS),
        }
      }
      const bucket = current(ip, at)
      if (bucket.count >= options.ipPerHour) {
        return {
          allowed: false,
          scope: 'ip',
          retryAfterSec: retry(at, bucket.start, HOUR_MS),
        }
      }
      if (ipBuckets.size > MAX_TRACKED_IPS) {
        ipBuckets.clear()
      }
      bucket.count += 1
      global.count += 1
      daily.count += 1
      return { allowed: true }
    },
    stats() {
      return {
        ipBuckets: ipBuckets.size,
        global: global.count,
        daily: daily.count,
      }
    },
  }
}

export type Slot = {
  release: () => void
}

export type AcquireResult = { ok: true; slot: Slot } | { ok: false }

export type SupportGate = {
  acquire: () => Promise<AcquireResult>
  stats: () => { active: number; queued: number }
}

export function createSupportGate(
  limit: number,
  maxQueue: number,
  waitMs: number,
): SupportGate {
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

  return {
    acquire() {
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
        }, waitMs)
        queue.push(grant)
      })
    },
    stats: () => ({ active, queued: queue.length }),
  }
}

export const supportLimiter = createSupportLimiter({
  ipPerHour: supportConfig.ipPerHour,
  globalPerHour: supportConfig.globalPerHour,
  dailyMax: supportConfig.dailyMax,
})

export const supportGate = createSupportGate(
  1,
  supportConfig.queueDepth,
  supportConfig.queueWaitMs,
)
