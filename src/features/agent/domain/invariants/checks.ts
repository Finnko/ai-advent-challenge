import type { ToolArgs } from '@lib/agent-loop/types'
import {
  runInvariantActionChecks,
  runInvariantAnswerChecks,
  type InvariantRule,
} from '@lib/invariants/checks'
import type { InvariantCode, InvariantRecord } from '@lib/invariants/types'
import type { AgentIdentity } from '../agent'
import {
  clampDuration,
  normalizeName,
  pickString,
  timeToMinutes,
} from '../agent-tools'

export type InvariantCheckResult = {
  ok: boolean
  hits: InvariantCode[]
  reason: string | null
}

function narrow(result: {
  ok: boolean
  hits: string[]
  reason: string | null
}): InvariantCheckResult {
  return {
    ok: result.ok,
    hits: result.hits as InvariantCode[],
    reason: result.reason,
  }
}

const dateDiff = (start: string, end: string) => {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  return Number.isFinite(from) && Number.isFinite(to)
    ? Math.floor((to - from) / 86_400_000)
    : null
}

function recommendsForbiddenDatabase(text: string): boolean {
  return /(?:используем|использовать|предлагаю|предложить|схем\w*|переход\w*|подключ\w*)[^.\n]{0,60}\b(?:postgres(?:ql)?|mysql|mongo(?:db)?)\b|\b(?:postgres(?:ql)?|mysql|mongo(?:db)?)\b[^.\n]{0,60}(?:используем|использовать|предлагаю|предложить|схем\w*|подключ\w*)/.test(
    text,
  )
}

function meetingEndsTooLate(args: ToolArgs): boolean {
  const time = pickString(args, 'time')
  const duration = clampDuration(args.duration)
  if (time.length === 0) {
    return false
  }
  return timeToMinutes(time) + duration > 18 * 60 + 30
}

const AGENT_RULES: InvariantRule<AgentIdentity>[] = [
  {
    check: 'meeting-end-time',
    testAction: ({ tool, args }) =>
      (tool === 'bookMeetingRoom' || tool === 'rescheduleBooking') &&
      meetingEndsTooLate(args),
  },
  {
    check: 'vacation-duration',
    testAction: ({ tool, args }) => {
      if (tool !== 'requestVacation') {
        return false
      }
      const diff = dateDiff(pickString(args, 'start'), pickString(args, 'end'))
      return diff !== null && diff > 14
    },
  },
  {
    check: 'orion-employee',
    testAction: ({ tool, args }, identity) =>
      (tool === 'bookMeetingRoom' || tool === 'rescheduleBooking') &&
      identity.role === 'employee' &&
      normalizeName(pickString(args, 'room')).includes('орион'),
  },
  {
    check: 'sqlite-only',
    testAnswer: (answer) => {
      const lower = answer.toLowerCase()
      return (
        recommendsForbiddenDatabase(lower) ||
        /\bprisma\b|использ\w*[^.\n]{0,60}внешн(?:яя|ей|их)\s+бд/.test(lower)
      )
    },
  },
  {
    check: 'server-secrets',
    testAnswer: (answer) =>
      /vite_\w*|import\.meta\.env|ключ\w*\s+в\s+браузер/.test(
        answer.toLowerCase(),
      ),
  },
]

export function runActionChecks(
  tool: string,
  args: ToolArgs,
  identity: AgentIdentity,
  invariants: InvariantRecord[],
) {
  return narrow(
    runInvariantActionChecks(invariants, AGENT_RULES, { tool, args }, identity),
  )
}

export function runAnswerChecks(answer: string, invariants: InvariantRecord[]) {
  return narrow(runInvariantAnswerChecks(invariants, AGENT_RULES, answer))
}
