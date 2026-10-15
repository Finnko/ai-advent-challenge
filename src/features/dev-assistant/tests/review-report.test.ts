import { describe, expect, it } from 'vitest'
import {
  normalizeRepoPath,
  parseReviewReport,
  renderInlineComment,
  renderReviewBody,
  splitFindings,
} from '../domain/review-report'

describe('review report contract', () => {
  it('parses the JSON contract and keeps valid findings', () => {
    const report = parseReviewReport(
      JSON.stringify({
        summary: 'Есть одна проблема.',
        findings: [
          {
            severity: 'bug',
            file: 'src/lib/a.ts',
            line: 12,
            message: 'деление на ноль',
            suggestion: 'проверь знаменатель',
          },
          { severity: 'nonsense', message: 'без файла и строки' },
          { severity: 'bug', message: '' },
        ],
      }),
    )
    expect(report.format).toBe('json')
    expect(report.summary).toBe('Есть одна проблема.')
    expect(report.findings).toEqual([
      {
        severity: 'bug',
        file: 'src/lib/a.ts',
        line: 12,
        message: 'деление на ноль',
        suggestion: 'проверь знаменатель',
      },
      {
        severity: 'style',
        file: '',
        line: 0,
        message: 'без файла и строки',
        suggestion: '',
      },
    ])
  })

  it('unwraps fenced JSON', () => {
    const report = parseReviewReport(
      '```json\n{"summary": "ok", "findings": []}\n```',
    )
    expect(report.format).toBe('json')
    expect(report.summary).toBe('ok')
  })

  it('extracts the JSON object from surrounding prose', () => {
    const report = parseReviewReport(
      'Вот ревью:\n{"summary": "ok", "findings": []}\nГотово.',
    )
    expect(report.format).toBe('json')
    expect(report.summary).toBe('ok')
  })

  it('degrades to text when the model does not answer with JSON', () => {
    const report = parseReviewReport('Извините, не могу сделать ревью.')
    expect(report.format).toBe('text')
    expect(report.findings).toEqual([])
    expect(report.summary).toContain('не могу')
  })

  it('only anchors findings that land on an added line of the diff', () => {
    const changed = new Map([['src/lib/a.ts', new Set([2])]])
    const report = parseReviewReport(
      JSON.stringify({
        summary: '',
        findings: [
          {
            severity: 'bug',
            file: 'b/src/lib/a.ts',
            line: 2,
            message: 'попал',
          },
          {
            severity: 'bug',
            file: 'src/lib/a.ts',
            line: 1,
            message: 'контекст',
          },
          {
            severity: 'bug',
            file: 'src/lib/b.ts',
            line: 1,
            message: 'не тот файл',
          },
          { severity: 'style', file: 'src/lib/a.ts', message: 'нет строки' },
        ],
      }),
    )
    const { inline, summary } = splitFindings(report.findings, changed)
    expect(inline).toHaveLength(1)
    expect(inline[0]).toMatchObject({ path: 'src/lib/a.ts', line: 2 })
    expect(summary.map((finding) => finding.message)).toEqual([
      'контекст',
      'не тот файл',
      'нет строки',
    ])
  })

  it('normalises repository paths and renders comments', () => {
    expect(normalizeRepoPath('b/src/lib/a.ts')).toBe('src/lib/a.ts')
    expect(normalizeRepoPath('./src/lib/a.ts')).toBe('src/lib/a.ts')
    expect(normalizeRepoPath('src\\lib\\a.ts')).toBe('src/lib/a.ts')

    const body = renderInlineComment({
      severity: 'architecture',
      file: 'src/lib/a.ts',
      line: 3,
      message: 'слой тянет фичу',
      suggestion: 'спрячь за швом',
    })
    expect(body).toContain('**Architecture.**')
    expect(body).toContain('спрячь за швом')
  })

  it('renders the summary with unanchored findings and service info', () => {
    const report = parseReviewReport(
      JSON.stringify({ summary: 'Резюме', findings: [] }),
    )
    const body = renderReviewBody({
      report,
      meta: {
        model: 'deepseek-flash',
        files: 3,
        lines: 9,
        truncated: true,
        omitted: ['package-lock.json'],
      },
      summaryFindings: [
        {
          severity: 'architecture',
          file: 'src/lib/x.ts',
          line: 0,
          message: 'структура',
          suggestion: '',
        },
      ],
    })
    expect(body).toContain('## 🤖 AI-ревью')
    expect(body).toContain('Резюме')
    expect(body).toContain('### Архитектурные проблемы')
    expect(body).toContain('deepseek-flash')
    expect(body).toContain('пропущено файлов — 1')
  })
})
