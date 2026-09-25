import {
  MAX_INTERVAL_MINUTES,
  MAX_WINDOW_HOURS,
  MIN_INTERVAL_MINUTES,
  MIN_WINDOW_HOURS,
  RUN_RETENTION_DAYS,
} from './types.ts'

export type ScheduleInput =
  | { ok: true; intervalMinutes: number; windowHours: number }
  | { ok: false; error: string }

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null
  }
  return parsed
}

export function validateScheduleInput(
  interval: unknown,
  window: unknown,
): ScheduleInput {
  const intervalMinutes = toInteger(interval)
  if (intervalMinutes === null) {
    return { ok: false, error: 'Интервал должен быть целым числом минут.' }
  }
  if (
    intervalMinutes < MIN_INTERVAL_MINUTES ||
    intervalMinutes > MAX_INTERVAL_MINUTES
  ) {
    return {
      ok: false,
      error: `Интервал должен быть от ${MIN_INTERVAL_MINUTES} до ${MAX_INTERVAL_MINUTES} минут.`,
    }
  }
  const windowHours = toInteger(window)
  if (windowHours === null) {
    return { ok: false, error: 'Окно агрегации должно быть целым числом часов.' }
  }
  if (windowHours < MIN_WINDOW_HOURS || windowHours > MAX_WINDOW_HOURS) {
    return {
      ok: false,
      error: `Окно агрегации должно быть от ${MIN_WINDOW_HOURS} до ${MAX_WINDOW_HOURS} часов.`,
    }
  }
  return { ok: true, intervalMinutes, windowHours }
}

export function computeNextRun(now: Date, intervalMinutes: number): string {
  return new Date(now.getTime() + intervalMinutes * 60_000).toISOString()
}

export function isDue(nextRunAt: string, now: Date): boolean {
  const next = Date.parse(nextRunAt)
  if (Number.isNaN(next)) {
    return true
  }
  return next <= now.getTime()
}

export function retentionCutoff(now: Date): string {
  return new Date(
    now.getTime() - RUN_RETENTION_DAYS * 24 * 60 * 60_000,
  ).toISOString()
}
