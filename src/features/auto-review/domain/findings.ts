const MAX_FINDINGS = 8
const MAX_FINDING_LENGTH = 300

const SOFT_VERBS = new Set([
  'следует',
  'надо',
  'необходимо',
  'рекомендуется',
  'стоит',
  'проверьте',
  'уберите',
  'добавьте',
  'перенесите',
  'замените',
  'переименуйте',
])

function lowerSoftVerb(text: string): string {
  const space = text.search(/\s/)
  const first = (space === -1 ? text : text.slice(0, space)).toLowerCase()
  if (!SOFT_VERBS.has(first) || !/^[А-ЯA-Z]/.test(text)) {
    return text
  }
  return text.charAt(0).toLowerCase() + text.slice(1)
}

export function normalizeFinding(raw: string): string | null {
  const text = lowerSoftVerb(
    raw
      .replace(/^\s*[-–—•*]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  if (text.length === 0) {
    return null
  }
  return text.length > MAX_FINDING_LENGTH
    ? `${text.slice(0, MAX_FINDING_LENGTH - 1).trimEnd()}…`
    : text
}

export function normalizeFindings(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue
    }
    const finding = normalizeFinding(item)
    if (!finding || seen.has(finding)) {
      continue
    }
    seen.add(finding)
    result.push(finding)
    if (result.length >= MAX_FINDINGS) {
      break
    }
  }
  return result
}

export function formatFindings(findings: string[]): string {
  return findings.map((finding) => `- ${finding}`).join('\n')
}
