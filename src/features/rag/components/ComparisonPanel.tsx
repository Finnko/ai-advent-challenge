import { useRagComparison } from '../api/use-rag-comparison'
import { STRATEGY_LABELS } from '../data/rag-ui'
import type { StrategyComparison } from '../types'
import { Alert } from '@/components/ui/Alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

type Row = {
  label: string
  value: (entry: StrategyComparison) => string
}

const ROWS: Row[] = [
  { label: 'Чанков', value: (e) => String(e.structural.chunkCount) },
  { label: 'Токенов всего', value: (e) => String(e.structural.totalTokens) },
  { label: 'Средний размер', value: (e) => e.structural.avgTokens.toFixed(1) },
  { label: 'Медиана', value: (e) => String(e.structural.medianTokens) },
  {
    label: 'Мин / макс',
    value: (e) => `${e.structural.minTokens} / ${e.structural.maxTokens}`,
  },
  {
    label: 'Режут границу раздела',
    value: (e) =>
      `${e.structural.crossesSection} (${(
        e.structural.crossesSectionRatio * 100
      ).toFixed(1)}%)`,
  },
  { label: 'recall@3', value: (e) => e.retrieval.recallAt3.toFixed(3) },
  { label: 'recall@5', value: (e) => e.retrieval.recallAt5.toFixed(3) },
  { label: 'MRR', value: (e) => e.retrieval.mrr.toFixed(3) },
  {
    label: 'Модель',
    value: (e) => e.model ?? '—',
  },
  {
    label: 'Собран',
    value: (e) =>
      e.builtAt ? new Date(e.builtAt).toLocaleString('ru-RU') : '—',
  },
]

export default function ComparisonPanel() {
  const comparison = useRagComparison()
  const entries = comparison.data?.strategies ?? []

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Сравнение стратегий</CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          <p className="demo-muted m-0 text-xs">
            Retrieval-метрики посчитаны на наборе из{' '}
            {comparison.data?.queryCount ?? 0} вопросов; релевантность — на
            уровне статьи.
          </p>
        </CardContent>
      </Card>

      {comparison.error && (
        <Alert variant="destructive">
          {comparison.error instanceof Error
            ? comparison.error.message
            : String(comparison.error)}
        </Alert>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  Метрика
                </th>
                {entries.map((entry) => (
                  <th
                    key={entry.strategy}
                    className="border-b border-[var(--line)] px-3 py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]"
                  >
                    {STRATEGY_LABELS[entry.strategy]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="border-b border-[var(--line)] px-3 py-2 text-[var(--ink-soft)]">
                    {row.label}
                  </td>
                  {entries.map((entry) => (
                    <td
                      key={entry.strategy}
                      className="border-b border-[var(--line)] px-3 py-2 font-semibold text-[var(--ink)]"
                    >
                      {row.value(entry)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
