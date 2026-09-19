import type { AgentIdentity, ToolArgs } from '../agent'
import { clampDuration, normalizeName, pickString, timeToMinutes } from '../agent-tools'
import { invariantCode, type InvariantCode, type InvariantRecord } from './types'

export type InvariantCheckResult = {
  ok: boolean
  hits: InvariantCode[]
  reason: string | null
}

const dateDiff = (start: string, end: string) => {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  return Number.isFinite(from) && Number.isFinite(to)
    ? Math.floor((to - from) / 86_400_000)
    : null
}

function hasCheck(invariants: InvariantRecord[], check: InvariantRecord['check']) {
  return invariants.find((record) => record.check === check)
}

function recommendsForbiddenDatabase(text: string): boolean {
  return /(?:используем|использовать|предлагаю|предложить|схем\w*|переход\w*|подключ\w*)[^.\n]{0,60}\b(?:postgres(?:ql)?|mysql|mongo(?:db)?)\b|\b(?:postgres(?:ql)?|mysql|mongo(?:db)?)\b[^.\n]{0,60}(?:используем|использовать|предлагаю|предложить|схем\w*|подключ\w*)/.test(text)
}

function resultForHits(hits: InvariantRecord[]): InvariantCheckResult {
  return {
    ok: hits.length === 0,
    hits: hits.map(invariantCode),
    reason:
      hits.length > 0
        ? hits.map((record) => `${invariantCode(record)}: ${record.text}`).join('\n')
        : null,
  }
}

export function runActionChecks(
  tool: string,
  args: ToolArgs,
  identity: AgentIdentity,
  invariants: InvariantRecord[],
): InvariantCheckResult {
  const hits: InvariantRecord[] = []
  const time = pickString(args, 'time')
  const duration = clampDuration(args.duration)
  const startMinutes = time.length > 0 ? timeToMinutes(time) : null
  const endMinutes = startMinutes === null ? null : startMinutes + duration
  if (
    (tool === 'bookMeetingRoom' || tool === 'rescheduleBooking') &&
    endMinutes !== null &&
    endMinutes > 18 * 60 + 30
  ) {
    const record = hasCheck(invariants, 'meeting-end-time')
    if (record) {
      hits.push(record)
    }
  }
  if (tool === 'requestVacation') {
    const diff = dateDiff(pickString(args, 'start'), pickString(args, 'end'))
    const record = hasCheck(invariants, 'vacation-duration')
    if (record && diff !== null && diff > 14) {
      hits.push(record)
    }
  }
  if (tool === 'bookMeetingRoom' || tool === 'rescheduleBooking') {
    const room = normalizeName(pickString(args, 'room'))
    const record = hasCheck(invariants, 'orion-employee')
    if (record && identity.role === 'employee' && room.includes('орион')) {
      hits.push(record)
    }
  }
  return resultForHits(hits)
}

export function runAnswerChecks(
  answer: string,
  invariants: InvariantRecord[],
): InvariantCheckResult {
  const hits: InvariantRecord[] = []
  const lower = answer.toLowerCase()
  const sqlite = hasCheck(invariants, 'sqlite-only')
  if (sqlite && (recommendsForbiddenDatabase(lower) || /\bprisma\b|использ\w*[^.\n]{0,60}внешн(?:яя|ей|их)\s+бд/.test(lower))) {
    hits.push(sqlite)
  }
  const secrets = hasCheck(invariants, 'server-secrets')
  if (secrets && /vite_\w*|import\.meta\.env|ключ\w*\s+в\s+браузер/.test(lower)) {
    hits.push(secrets)
  }
  return resultForHits(hits)
}
