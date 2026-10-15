import { describe, expect, it } from 'vitest'
import type { ReviewFinding } from '../domain/review-report'
import { applyVerdicts, parseVerdicts } from '../domain/review-verdict'

function finding(message: string, overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    severity: 'bug',
    file: 'src/lib/a.ts',
    line: 2,
    message,
    suggestion: 'исправь',
    ...overrides,
  }
}

describe('judge verdicts', () => {
  it('parses the verdict contract, fenced or wrapped in prose', () => {
    const fenced = parseVerdicts(
      '```json\n{"verdicts": [{"id": 1, "keep": false, "reason": "не подтверждается"}]}\n```',
    )
    expect(fenced).toEqual([
      { id: 1, keep: false, severity: null, reason: 'не подтверждается' },
    ])

    const prose = parseVerdicts(
      'Вот вердикты:\n{"verdicts": [{"id": 2, "keep": true, "severity": "style"}]}\nГотово.',
    )
    expect(prose).toEqual([
      { id: 2, keep: true, severity: 'style', reason: '' },
    ])
  })

  it('ignores malformed entries and duplicate ids', () => {
    const verdicts = parseVerdicts(
      JSON.stringify({
        verdicts: [
          { id: 1, keep: true },
          { id: 1, keep: false, reason: 'дубликат id' },
          { id: '2', keep: true },
          { keep: true },
          { id: 0, keep: true },
          { id: 2 },
          'мусор',
        ],
      }),
    )
    expect(verdicts).toEqual([{ id: 1, keep: true, severity: null, reason: '' }])
  })

  it('returns null when the answer is not a verdict contract', () => {
    expect(parseVerdicts('Извините, не могу.')).toBeNull()
    expect(parseVerdicts('{"summary": "не тот контракт"}')).toBeNull()
    expect(parseVerdicts('{"verdicts": "нет"}')).toBeNull()
  })

  it('keeps every finding when the judge did not run', () => {
    const findings = [finding('первая'), finding('вторая')]
    const outcome = applyVerdicts(findings, null)
    expect(outcome.filtered).toBe(false)
    expect(outcome.kept).toEqual(findings)
    expect(outcome.dropped).toEqual([])
  })

  it('drops rejected findings, keeps the silent ones and never rewrites text', () => {
    const findings = [
      finding('подтверждённая'),
      finding('выдуманная'),
      finding('судья промолчал'),
      { ...finding('тихая придирка'), severity: 'bug' as const },
    ]
    const outcome = applyVerdicts(findings, [
      { id: 1, keep: true, severity: null, reason: 'подтверждается диффом' },
      { id: 2, keep: false, severity: null, reason: 'нет в диффе' },
      { id: 4, keep: true, severity: 'style', reason: 'придирка, не баг' },
    ])

    expect(outcome.filtered).toBe(true)
    expect(outcome.kept.map((entry) => entry.message)).toEqual([
      'подтверждённая',
      'судья промолчал',
      'тихая придирка',
    ])
    expect(outcome.kept[2].severity).toBe('style')
    expect(outcome.kept[0]).toBe(findings[0])
    expect(outcome.dropped).toEqual([
      { finding: findings[1], reason: 'нет в диффе' },
    ])
  })

  it('never lets the judge move a finding off its anchor', () => {
    const original = finding('смещение', { line: 42, file: 'src/lib/b.ts' })
    const outcome = applyVerdicts([original], [
      { id: 1, keep: true, severity: 'architecture', reason: 'понизил' },
    ])
    expect(outcome.kept[0]).toMatchObject({
      file: 'src/lib/b.ts',
      line: 42,
      message: 'смещение',
      suggestion: 'исправь',
    })
  })
})
