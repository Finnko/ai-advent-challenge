import type { ToolArgs } from '@lib/agent-loop/types'
import { invariantCode, type InvariantRecord } from './types'

export type InvariantCheckResult = {
  ok: boolean
  hits: string[]
  reason: string | null
}

export type InvariantCall = {
  tool: string
  args: ToolArgs
}

export type InvariantRule<TContext = unknown> = {
  check: string
  testAction?: (call: InvariantCall, ctx: TContext) => boolean
  testAnswer?: (answer: string) => boolean
}

function findRecord(
  invariants: InvariantRecord[],
  check: string,
): InvariantRecord | undefined {
  return invariants.find((record) => record.check === check)
}

function resultForHits(hits: InvariantRecord[]): InvariantCheckResult {
  return {
    ok: hits.length === 0,
    hits: hits.map((record) => invariantCode(record)),
    reason:
      hits.length > 0
        ? hits
            .map((record) => `${invariantCode(record)}: ${record.text}`)
            .join('\n')
        : null,
  }
}

export function runInvariantActionChecks<TContext>(
  invariants: InvariantRecord[],
  rules: InvariantRule<TContext>[],
  call: InvariantCall,
  ctx: TContext,
): InvariantCheckResult {
  const hits: InvariantRecord[] = []
  for (const rule of rules) {
    if (!rule.testAction) {
      continue
    }
    const record = findRecord(invariants, rule.check)
    if (record && rule.testAction(call, ctx)) {
      hits.push(record)
    }
  }
  return resultForHits(hits)
}

export function runInvariantAnswerChecks<TContext>(
  invariants: InvariantRecord[],
  rules: InvariantRule<TContext>[],
  answer: string,
): InvariantCheckResult {
  const hits: InvariantRecord[] = []
  for (const rule of rules) {
    if (!rule.testAnswer) {
      continue
    }
    const record = findRecord(invariants, rule.check)
    if (record && rule.testAnswer(answer)) {
      hits.push(record)
    }
  }
  return resultForHits(hits)
}
