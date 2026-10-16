import type {
  DroppedFinding,
  ReviewFinding,
  ReviewSeverity,
} from './review-report'
import { isReviewSeverity, parseLooseJson } from './review-report'

export type FindingVerdict = {
  id: number
  keep: boolean
  severity: ReviewSeverity | null
  reason: string
}

export type JudgeOutcome = {
  kept: ReviewFinding[]
  dropped: DroppedFinding[]
  filtered: boolean
}

function toVerdict(value: unknown): FindingVerdict | null {
  if (value === null || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const id = record.id
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
    return null
  }
  if (typeof record.keep !== 'boolean') {
    return null
  }
  return {
    id,
    keep: record.keep,
    severity: isReviewSeverity(record.severity) ? record.severity : null,
    reason: typeof record.reason === 'string' ? record.reason.trim() : '',
  }
}

export function parseVerdicts(content: string): FindingVerdict[] | null {
  const parsed = parseLooseJson(content)
  if (parsed === null || typeof parsed !== 'object') {
    return null
  }
  const raw = (parsed as { verdicts?: unknown }).verdicts
  if (!Array.isArray(raw)) {
    return null
  }
  const verdicts: FindingVerdict[] = []
  const seen = new Set<number>()
  for (const entry of raw) {
    const verdict = toVerdict(entry)
    if (verdict === null || seen.has(verdict.id)) {
      continue
    }
    seen.add(verdict.id)
    verdicts.push(verdict)
  }
  return verdicts
}

export function applyVerdicts(
  findings: ReviewFinding[],
  verdicts: FindingVerdict[] | null,
): JudgeOutcome {
  if (verdicts === null) {
    return { kept: [...findings], dropped: [], filtered: false }
  }
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]))
  const kept: ReviewFinding[] = []
  const dropped: DroppedFinding[] = []
  findings.forEach((finding, index) => {
    const verdict = byId.get(index + 1)
    if (!verdict) {
      kept.push(finding)
      return
    }
    if (!verdict.keep) {
      dropped.push({ finding, reason: verdict.reason })
      return
    }
    kept.push(
      verdict.severity && verdict.severity !== finding.severity
        ? { ...finding, severity: verdict.severity }
        : finding,
    )
  })
  return { kept, dropped, filtered: true }
}
