import { Fragment } from 'react'
import type { GroupSummary, StoredRun } from '../domain/results'
import { formatPercent } from './format'

type SummaryTilesProps = {
  summaries: GroupSummary[]
  runs: StoredRun[]
  defaultConfigId: string
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function baselineKeys(runs: StoredRun[]): string[] {
  const run = runs.find(
    (candidate) =>
      candidate.config.axis === 'baseline' && candidate.facts === null,
  )
  if (!run) {
    return []
  }
  return [...run.raw.matchAll(/"([^"]+)"\s*:/g)]
    .map((match) => match[1])
    .slice(0, 3)
}

export default function SummaryTiles({
  summaries,
  runs,
  defaultConfigId,
}: SummaryTilesProps) {
  const before = summaries.filter((summary) => summary.axis === 'baseline')
  const after = summaries.filter(
    (summary) => summary.configId === defaultConfigId,
  )
  const beforeAccuracy = average(
    before.map((summary) => summary.overallAccuracy),
  )
  const afterAccuracy = average(after.map((summary) => summary.overallAccuracy))
  const keys = baselineKeys(runs)
  const docCount = new Set(
    runs
      .filter((run) => run.config.id === defaultConfigId)
      .map((run) => run.docId),
  ).size

  if (beforeAccuracy === null || afterAccuracy === null) {
    return (
      <p className="demo-muted m-0 text-sm">
        Прогони базовую конфигурацию (P0) и схему (P1), чтобы увидеть эффект
        промпта.
      </p>
    )
  }

  const tiles = [
    {
      kicker: 'До · P0 без схемы',
      value: formatPercent(beforeAccuracy),
      note: 'формально JSON, но ключи не те',
      color: 'var(--danger)',
    },
    {
      kicker: 'После · P1 со схемой',
      value: formatPercent(afterAccuracy),
      note: `${after.length} модели · ${docCount} документов`,
      color: 'var(--positive)',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {tiles.map((tile, index) => (
          <Fragment key={tile.kicker}>
            {index > 0 && (
              <span className="shrink-0 self-center text-2xl text-[var(--ink-muted)]">
                →
              </span>
            )}
            <div className="flex flex-1 flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-tint)] px-4 py-3">
              <span className="demo-muted text-xs font-semibold uppercase tracking-wide">
                {tile.kicker}
              </span>
              <span
                className="text-3xl font-bold leading-none"
                style={{ color: tile.color }}
              >
                {tile.value}
              </span>
              <span className="demo-muted text-xs">{tile.note}</span>
            </div>
          </Fragment>
        ))}
      </div>
      {keys.length > 0 && (
        <p className="demo-muted m-0 text-xs">
          База изобрела ключи{' '}
          {keys.map((key) => (
            <code key={key} className="mr-1 text-[var(--danger)]">
              {key}
            </code>
          ))}
          вместо{' '}
          <code className="text-[var(--positive)]">
            founded_year, area_km2, federal_district
          </code>
          .
        </p>
      )}
    </div>
  )
}
