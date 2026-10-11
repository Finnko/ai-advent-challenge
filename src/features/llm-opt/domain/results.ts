import type { ChatUsage } from '@lib/llm'
import type { AxisId, ExperimentConfig } from '../data/configs'
import { FIELD_IDS, type ExtractedFacts, type FieldId } from './extraction'
import type { FieldResult } from './metric'

export type StoredRun = {
  id: string
  model: string
  config: ExperimentConfig
  docId: string
  repeat: number
  raw: string
  facts: ExtractedFacts | null
  format: 'json' | 'text'
  fields: FieldResult[]
  score: number
  valid: boolean
  latencyMs: number
  usage: ChatUsage | null
  tokensPerSecond: number | null
  memBeforeMb: number | null
  memAfterMb: number | null
  createdAt: string
}

export function runId(
  model: string,
  configId: string,
  docId: string,
  repeat: number,
): string {
  return [model, configId, docId, `r${repeat}`].join('|')
}

export type GroupSummary = {
  model: string
  configId: string
  label: string
  axis: AxisId
  runs: number
  fieldAccuracy: Record<FieldId, number>
  overallAccuracy: number
  fullMatchRate: number
  jsonRate: number
  avgLatencyMs: number | null
  avgTokensPerSecond: number | null
  peakMemMb: number | null
}

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : part / total
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function summarizeGroup(
  model: string,
  config: ExperimentConfig,
  runs: StoredRun[],
): GroupSummary {
  const fieldCorrect = Object.fromEntries(
    FIELD_IDS.map((field) => [field, 0]),
  ) as Record<FieldId, number>
  let correctFields = 0
  let totalFields = 0
  let fullMatches = 0
  let jsonRuns = 0
  const latencies: number[] = []
  const speeds: number[] = []
  const memory: number[] = []

  for (const run of runs) {
    if (run.format === 'json') {
      jsonRuns += 1
    }
    if (run.valid) {
      fullMatches += 1
    }
    for (const field of run.fields) {
      totalFields += 1
      if (field.correct) {
        fieldCorrect[field.field] += 1
        correctFields += 1
      }
    }
    latencies.push(run.latencyMs)
    if (run.tokensPerSecond !== null) {
      speeds.push(run.tokensPerSecond)
    }
    if (run.memAfterMb !== null) {
      memory.push(run.memAfterMb)
    } else if (run.memBeforeMb !== null) {
      memory.push(run.memBeforeMb)
    }
  }

  const runsCount = runs.length
  return {
    model,
    configId: config.id,
    label: config.label,
    axis: config.axis,
    runs: runsCount,
    fieldAccuracy: Object.fromEntries(
      FIELD_IDS.map((field) => [field, ratio(fieldCorrect[field], runsCount)]),
    ) as Record<FieldId, number>,
    overallAccuracy: ratio(correctFields, totalFields),
    fullMatchRate: ratio(fullMatches, runsCount),
    jsonRate: ratio(jsonRuns, runsCount),
    avgLatencyMs: average(latencies),
    avgTokensPerSecond: average(speeds),
    peakMemMb: memory.length > 0 ? Math.max(...memory) : null,
  }
}

export function summarizeRuns(runs: StoredRun[]): GroupSummary[] {
  const groups = new Map<
    string,
    { model: string; config: ExperimentConfig; runs: StoredRun[] }
  >()
  for (const run of runs) {
    const key = `${run.model}::${run.config.id}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.runs.push(run)
    } else {
      groups.set(key, { model: run.model, config: run.config, runs: [run] })
    }
  }
  const summaries = [...groups.values()].map((group) =>
    summarizeGroup(group.model, group.config, group.runs),
  )
  return summaries.sort((a, b) => {
    if (a.model !== b.model) {
      return a.model.localeCompare(b.model)
    }
    return a.overallAccuracy - b.overallAccuracy
  })
}

export function pickWinner(summaries: GroupSummary[]): GroupSummary | null {
  let winner: GroupSummary | null = null
  for (const summary of summaries) {
    if (winner === null) {
      winner = summary
      continue
    }
    if (summary.overallAccuracy > winner.overallAccuracy) {
      winner = summary
      continue
    }
    if (summary.overallAccuracy < winner.overallAccuracy) {
      continue
    }
    const latency = summary.avgLatencyMs ?? Number.POSITIVE_INFINITY
    const winnerLatency = winner.avgLatencyMs ?? Number.POSITIVE_INFINITY
    if (latency < winnerLatency) {
      winner = summary
      continue
    }
    if (latency > winnerLatency) {
      continue
    }
    const mem = summary.peakMemMb ?? Number.POSITIVE_INFINITY
    const winnerMem = winner.peakMemMb ?? Number.POSITIVE_INFINITY
    if (mem < winnerMem) {
      winner = summary
    }
  }
  return winner
}
