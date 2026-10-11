import { describe, expect, it } from 'vitest'
import { SWEEP_CONFIGS } from '../data/configs'
import type { StoredRun } from '../domain/results'
import { pickWinner, summarizeRuns } from '../domain/results'

function makeRun(overrides: Partial<StoredRun>): StoredRun {
  const config = overrides.config ?? SWEEP_CONFIGS[0]
  return {
    id: `run-${Math.random()}`,
    model: 'test-model',
    config,
    docId: 'moscow',
    repeat: 0,
    raw: '{}',
    facts: null,
    format: 'json',
    fields: [],
    score: 0,
    valid: false,
    latencyMs: 100,
    usage: null,
    tokensPerSecond: null,
    memBeforeMb: null,
    memAfterMb: null,
    createdAt: '2026-10-09T00:00:00.000Z',
    ...overrides,
  }
}

const FIELDS_OK = [
  {
    field: 'founded_year' as const,
    expected: '1147',
    actual: '1147',
    correct: true,
  },
  {
    field: 'area_km2' as const,
    expected: '2561.5',
    actual: '2561.5',
    correct: true,
  },
  {
    field: 'federal_district' as const,
    expected: 'Центральный',
    actual: 'Центральный',
    correct: true,
  },
]

describe('summarizeRuns', () => {
  it('считает точность по полям и скорость по группе', () => {
    const summaries = summarizeRuns([
      makeRun({
        id: 'a',
        fields: FIELDS_OK,
        valid: true,
        score: 1,
        latencyMs: 100,
        tokensPerSecond: 20,
      }),
      makeRun({
        id: 'b',
        fields: FIELDS_OK,
        valid: true,
        score: 1,
        latencyMs: 300,
        tokensPerSecond: 10,
      }),
    ])
    expect(summaries).toHaveLength(1)
    expect(summaries[0].overallAccuracy).toBe(1)
    expect(summaries[0].fullMatchRate).toBe(1)
    expect(summaries[0].avgLatencyMs).toBe(200)
    expect(summaries[0].avgTokensPerSecond).toBe(15)
  })
})

describe('pickWinner', () => {
  it('выбирает конфигурацию с большей точностью', () => {
    const bad = SWEEP_CONFIGS[0]
    const better = SWEEP_CONFIGS[1]
    const badFields = [
      { ...FIELDS_OK[0], actual: '2025', correct: false },
      FIELDS_OK[1],
      FIELDS_OK[2],
    ]
    const summaries = summarizeRuns([
      makeRun({ id: 'bad', config: bad, fields: badFields }),
      makeRun({ id: 'better', config: better, fields: FIELDS_OK, valid: true }),
    ])
    expect(pickWinner(summaries)?.configId).toBe(better.id)
  })
})
