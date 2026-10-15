export type ReviewSeverity = 'bug' | 'architecture' | 'style'

export type ReviewFinding = {
  severity: ReviewSeverity
  file: string
  line: number
  message: string
  suggestion: string
}

export type ReviewReport = {
  summary: string
  findings: ReviewFinding[]
  format: 'json' | 'text'
  raw: string
}

export const REVIEW_SEVERITIES: ReviewSeverity[] = [
  'bug',
  'architecture',
  'style',
]

export const REVIEW_SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  bug: 'Потенциальные баги',
  architecture: 'Архитектурные проблемы',
  style: 'Рекомендации и стиль',
}

export const REVIEW_SEVERITY_TAGS: Record<ReviewSeverity, string> = {
  bug: 'Bug',
  architecture: 'Architecture',
  style: 'Style',
}

export function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return (
    typeof value === 'string' && (REVIEW_SEVERITIES as string[]).includes(value)
  )
}

function stripFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

function toFinding(value: unknown): ReviewFinding | null {
  if (value === null || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const message =
    typeof record.message === 'string' ? record.message.trim() : ''
  if (message.length === 0) {
    return null
  }
  const rawLine = record.line
  const line =
    typeof rawLine === 'number' && Number.isFinite(rawLine) && rawLine > 0
      ? Math.trunc(rawLine)
      : 0
  return {
    severity: isReviewSeverity(record.severity) ? record.severity : 'style',
    file: typeof record.file === 'string' ? record.file.trim() : '',
    line,
    message,
    suggestion:
      typeof record.suggestion === 'string' ? record.suggestion.trim() : '',
  }
}

function extractJsonObject(content: string): string | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  return start === -1 || end <= start ? null : content.slice(start, end + 1)
}

function parseJson(content: string): unknown {
  for (const candidate of [stripFences(content), extractJsonObject(content)]) {
    if (candidate === null || candidate.length === 0) {
      continue
    }
    try {
      return JSON.parse(candidate)
    } catch {
      // try the next candidate
    }
  }
  return undefined
}

// The model is asked for `{summary, findings}`. Anything that is not that JSON
// (a refusal, a prose answer, a malformed payload) degrades to a text report
// instead of losing the whole review.
export function parseReviewReport(content: string): ReviewReport {
  const parsed = parseJson(content)
  if (parsed === null || typeof parsed !== 'object') {
    return {
      summary: content.trim(),
      findings: [],
      format: 'text',
      raw: content,
    }
  }
  const record = parsed as { summary?: unknown; findings?: unknown }
  const summary =
    typeof record.summary === 'string' ? record.summary.trim() : ''
  const findings = Array.isArray(record.findings)
    ? record.findings
        .map(toFinding)
        .filter((finding): finding is ReviewFinding => finding !== null)
    : []
  return { summary, findings, format: 'json', raw: content }
}

// GitHub only accepts an inline comment on a line that is part of the diff. The
// model names a path and a line; both must match an added/changed line or the
// finding falls back to the summary comment.
export function normalizeRepoPath(path: string): string {
  return path
    .trim()
    .replace(/^[ab]\//, '')
    .replace(/^\.\//, '')
    .replace(/\\/g, '/')
}

export type AnchoredFinding = {
  finding: ReviewFinding
  path: string
  line: number
}

export function splitFindings(
  findings: ReviewFinding[],
  changed: Map<string, Set<number>>,
): { inline: AnchoredFinding[]; summary: ReviewFinding[] } {
  const inline: AnchoredFinding[] = []
  const summary: ReviewFinding[] = []
  for (const finding of findings) {
    const path = normalizeRepoPath(finding.file)
    const lines = changed.get(path)
    if (path.length > 0 && finding.line > 0 && lines?.has(finding.line)) {
      inline.push({ finding, path, line: finding.line })
      continue
    }
    summary.push(finding)
  }
  return { inline, summary }
}

export type ReviewMeta = {
  model: string | null
  files: number
  lines: number
  truncated: boolean
  omitted: string[]
}

function renderFinding(finding: ReviewFinding, index: number): string {
  let location = '—'
  if (finding.file) {
    location =
      finding.line > 0
        ? `\`${finding.file}:${finding.line}\``
        : `\`${finding.file}\``
  }
  const lines = [`${index + 1}. ${location} — ${finding.message}`]
  if (finding.suggestion.length > 0) {
    lines.push(`   - Как исправить: ${finding.suggestion}`)
  }
  return lines.join('\n')
}

export function renderReviewBody(input: {
  report: ReviewReport
  meta: ReviewMeta
  summaryFindings: ReviewFinding[]
}): string {
  const { report, meta, summaryFindings } = input
  const parts: string[] = ['## 🤖 AI-ревью', '']
  parts.push(
    report.summary.length > 0
      ? report.summary
      : 'Модель не вернула резюме — смотрите замечания ниже.',
  )
  const anyFindings = report.findings.length + summaryFindings.length > 0
  if (!anyFindings) {
    parts.push('', 'Замечаний нет.')
  }
  for (const severity of REVIEW_SEVERITIES) {
    const bucket = summaryFindings.filter(
      (finding) => finding.severity === severity,
    )
    if (bucket.length === 0) {
      continue
    }
    parts.push('', `### ${REVIEW_SEVERITY_LABELS[severity]}`, '')
    parts.push(...bucket.map((finding, index) => renderFinding(finding, index)))
  }
  if (summaryFindings.length > 0) {
    parts.push(
      '',
      `_Замечания выше не привязаны к строкам диффа (нет валидного якоря) и потому собраны в сводке._`,
    )
  }
  parts.push('', '<details><summary>Служебная информация</summary>', '')
  parts.push(`- Модель: ${meta.model ?? '—'}`)
  parts.push(
    `- Файлов в диффе: ${meta.files}, добавленных строк: ${meta.lines}`,
  )
  parts.push(
    meta.truncated
      ? `- Дифф усечён: пропущено файлов — ${meta.omitted.length}${
          meta.omitted.length > 0
            ? ` (${meta.omitted.slice(0, 10).join(', ')})`
            : ''
        }`
      : '- Дифф целиком',
  )
  parts.push(`- В режиме JSON: ${report.format === 'json' ? 'да' : 'нет'}`)
  parts.push('', '</details>')
  return parts.join('\n')
}

export function renderInlineComment(finding: ReviewFinding): string {
  const parts = [
    `**${REVIEW_SEVERITY_TAGS[finding.severity]}.** ${finding.message}`,
  ]
  if (finding.suggestion.length > 0) {
    parts.push(`> ${finding.suggestion}`)
  }
  return parts.join('\n\n')
}
