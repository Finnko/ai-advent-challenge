import { describeModel } from '../data/models'
import type { GroupSummary } from '../domain/results'
import { formatLatency, formatMemory, formatPercent } from './format'

type FindingsListProps = {
  summaries: GroupSummary[]
  defaultConfigId: string
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function recommended(summaries: GroupSummary[]): GroupSummary | null {
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
    }
  }
  return winner
}

function buildFindings(
  summaries: GroupSummary[],
  defaultConfigId: string,
): string[] {
  const findings: string[] = []
  const best = Math.max(...summaries.map((summary) => summary.overallAccuracy))

  const baseline = summaries.filter((summary) => summary.axis === 'baseline')
  const after = summaries.filter(
    (summary) => summary.configId === defaultConfigId,
  )
  if (baseline.length > 0 && after.length > 0) {
    findings.push(
      `Схема-промпт решает всё: ${formatPercent(average(baseline.map((s) => s.overallAccuracy)))} → ${formatPercent(average(after.map((s) => s.overallAccuracy)))} на ${after.length} моделях.`,
    )
  }

  const tuning = summaries.filter(
    (summary) => summary.axis !== 'baseline' && summary.axis !== 'prompt',
  )
  if (
    tuning.length > 0 &&
    tuning.every((summary) => summary.overallAccuracy >= best)
  ) {
    findings.push(
      'Параметры, размер контекста и JSON-режим качество не меняют — только время и токены.',
    )
  }

  const onDefault = summaries.filter(
    (summary) => summary.configId === defaultConfigId,
  )
  const winner = recommended(onDefault)
  if (winner && winner.overallAccuracy >= best) {
    findings.push(
      `Для задачи выгоднее ${describeModel(winner.model).label}: ${formatLatency(winner.avgLatencyMs)} и ${formatMemory(winner.peakMemMb)} при ${formatPercent(winner.overallAccuracy)}.`,
    )
  }

  return findings
}

export default function FindingsList({
  summaries,
  defaultConfigId,
}: FindingsListProps) {
  const findings = buildFindings(summaries, defaultConfigId)
  if (findings.length === 0) {
    return null
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {findings.map((finding) => (
        <li key={finding} className="flex gap-2 text-sm text-[var(--ink-soft)]">
          <span className="mt-0.5 text-[var(--accent)]">◆</span>
          <span>{finding}</span>
        </li>
      ))}
    </ul>
  )
}
