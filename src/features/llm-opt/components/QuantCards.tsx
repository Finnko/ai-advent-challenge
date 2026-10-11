import { describeModel } from '../data/models'
import { pickWinner, type GroupSummary } from '../domain/results'
import AccuracyBar from './AccuracyBar'
import {
  formatLatency,
  formatMemory,
  formatPercent,
  formatSpeed,
} from './format'
import { Badge } from '@/components/ui/Badge'

type QuantCardsProps = {
  summaries: GroupSummary[]
  defaultConfigId: string
}

const MODEL_ORDER = [
  'mlx-community/Qwen3-14B-4bit',
  'mlx-community/Qwen3-14B-6bit',
  'mlx-community/Qwen3-8B-4bit',
]

function orderIndex(model: string): number {
  const index = MODEL_ORDER.indexOf(model)
  return index === -1 ? MODEL_ORDER.length : index
}

export default function QuantCards({
  summaries,
  defaultConfigId,
}: QuantCardsProps) {
  const rows = summaries
    .filter((summary) => summary.configId === defaultConfigId)
    .sort((a, b) => orderIndex(a.model) - orderIndex(b.model))

  if (rows.length === 0) {
    return (
      <p className="demo-muted m-0 text-sm">
        Нет прогонов конфигурации по умолчанию (P1).
      </p>
    )
  }

  const best = pickWinner(rows)?.model ?? null

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {rows.map((row) => {
        const info = describeModel(row.model)
        return (
          <div
            key={row.model}
            className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-tint)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-semibold text-[var(--ink)]">
                  {info.label}
                </span>
                {info.diskGb !== null && (
                  <span className="demo-muted text-xs">
                    {info.diskGb.toFixed(1)} ГБ на диске
                  </span>
                )}
              </div>
              {row.model === best && <Badge variant="success">лучший</Badge>}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--ink)]">
                {formatPercent(row.overallAccuracy)}
              </span>
              <AccuracyBar value={row.overallAccuracy} />
            </div>
            <dl className="m-0 grid grid-cols-3 gap-2 text-xs">
              {[
                {
                  label: 'латентность',
                  value: formatLatency(row.avgLatencyMs),
                },
                { label: 'ток/с', value: formatSpeed(row.avgTokensPerSecond) },
                { label: 'память', value: formatMemory(row.peakMemMb) },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-col gap-0.5">
                  <dt className="demo-muted m-0">{metric.label}</dt>
                  <dd className="m-0 font-semibold text-[var(--ink)]">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
