import { asRecord, asStringArray, parseJsonObject } from './json'
import { normalizeFindings } from './findings'

export type ModelVerdict = {
  code: string
  status: 'pass' | 'fail' | null
  reason: string
  findings: string[]
}

function parseStatus(value: unknown): 'pass' | 'fail' | null {
  if (value === 'pass') {
    return 'pass'
  }
  if (value === 'fail') {
    return 'fail'
  }
  return null
}

function parseVerdict(value: unknown): ModelVerdict | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }
  const code = typeof record.code === 'string' ? record.code.trim() : ''
  if (code.length === 0) {
    return null
  }
  const status = parseStatus(record.status)
  const reason = typeof record.reason === 'string' ? record.reason.trim() : ''
  const findings = normalizeFindings(record.findings ?? record.comments)
  return { code, status, reason, findings }
}

export function parseVerdicts(content: string): ModelVerdict[] {
  const root = asRecord(parseJsonObject(content))
  if (!root) {
    return []
  }
  const raw = root.verdicts ?? root.results ?? root.criteria ?? root.items ?? []
  if (!Array.isArray(raw)) {
    return []
  }
  const verdicts: ModelVerdict[] = []
  for (const item of raw) {
    const verdict = parseVerdict(item)
    if (verdict) {
      verdicts.push(verdict)
    }
  }
  return verdicts
}

export function verdictsByCode(
  verdicts: ModelVerdict[],
): Map<string, ModelVerdict> {
  return new Map(verdicts.map((verdict) => [verdict.code, verdict]))
}

export { asStringArray }
