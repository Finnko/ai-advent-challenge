import {
  SUPPORT_DAILY_MAX,
  SUPPORT_GLOBAL_PER_HOUR,
  SUPPORT_IP_PER_HOUR,
  SUPPORT_MAX_BODY_BYTES,
  SUPPORT_MAX_QUESTION_CHARS,
  SUPPORT_QUEUE_DEPTH,
  SUPPORT_QUEUE_WAIT_MS,
  SUPPORT_TIMEOUT_MS,
} from '../domain/constants'

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) {
    return fallback
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min) {
    return fallback
  }
  return Math.trunc(value)
}

export type SupportGenerator = 'cloud' | 'local'

export function resolveSupportGenerator(): SupportGenerator {
  return process.env.SUPPORT_GENERATOR?.trim() === 'local' ? 'local' : 'cloud'
}

export function resolveSupportPublic(): boolean {
  return process.env.SUPPORT_PUBLIC?.trim() === '1'
}

export const supportConfig = {
  ipPerHour: intEnv('SUPPORT_IP_PER_HOUR', SUPPORT_IP_PER_HOUR, 1),
  globalPerHour: intEnv('SUPPORT_GLOBAL_PER_HOUR', SUPPORT_GLOBAL_PER_HOUR, 1),
  dailyMax: intEnv('SUPPORT_DAILY_MAX', SUPPORT_DAILY_MAX, 1),
  maxQuestionChars: intEnv(
    'SUPPORT_MAX_QUESTION_CHARS',
    SUPPORT_MAX_QUESTION_CHARS,
    1,
  ),
  maxBodyBytes: intEnv('SUPPORT_MAX_BODY_BYTES', SUPPORT_MAX_BODY_BYTES, 1),
  timeoutMs: intEnv('SUPPORT_TIMEOUT_MS', SUPPORT_TIMEOUT_MS, 1_000),
  queueDepth: intEnv('SUPPORT_QUEUE_DEPTH', SUPPORT_QUEUE_DEPTH, 1),
  queueWaitMs: intEnv('SUPPORT_QUEUE_WAIT_MS', SUPPORT_QUEUE_WAIT_MS, 1_000),
}
