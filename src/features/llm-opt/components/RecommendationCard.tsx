import { describeModel } from '../data/models'
import { pickWinner, type GroupSummary } from '../domain/results'
import { formatLatency, formatMemory, formatPercent } from './format'
import { Badge } from '@/components/ui/Badge'

type RecommendationCardProps = {
  summaries: GroupSummary[]
  defaultConfigId: string
}

export default function RecommendationCard({
  summaries,
  defaultConfigId,
}: RecommendationCardProps) {
  const onDefault = summaries.filter(
    (summary) => summary.configId === defaultConfigId,
  )
  const winner = pickWinner(onDefault)
  if (!winner) {
    return null
  }
  const baseline =
    onDefault.find(
      (summary) => summary.model === 'mlx-community/Qwen3-14B-4bit',
    ) ?? onDefault.find((summary) => summary.model !== winner.model)

  const speedup =
    baseline?.avgLatencyMs && winner.avgLatencyMs
      ? baseline.avgLatencyMs / winner.avgLatencyMs
      : null
  const memoryCut =
    baseline?.peakMemMb && winner.peakMemMb
      ? 1 - winner.peakMemMb / baseline.peakMemMb
      : null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[color-mix(in_oklab,var(--accent)_40%,var(--line))] bg-[var(--accent-soft)] px-4 py-3">
      <span className="demo-muted text-xs font-semibold uppercase tracking-wide">
        Рекомендация
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl font-bold text-[var(--ink)]">
          {describeModel(winner.model).label}
        </span>
        <Badge variant="success">
          {formatPercent(winner.overallAccuracy)} качества
        </Badge>
        <span className="text-sm text-[var(--ink-soft)]">
          {winner.label} · {formatLatency(winner.avgLatencyMs)} ·{' '}
          {formatMemory(winner.peakMemMb)}
        </span>
      </div>
      {speedup !== null && memoryCut !== null && baseline && (
        <p className="m-0 text-sm text-[var(--ink-soft)]">
          Это ~{speedup.toFixed(1)}× быстрее и на {Math.round(memoryCut * 100)}%
          легче, чем {describeModel(baseline.model).label}, при том же качестве.
        </p>
      )}
      <p className="demo-muted m-0 text-xs">
        Критерий: максимум точности → минимум латентности → минимум памяти.
      </p>
    </div>
  )
}
