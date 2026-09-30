import { useState } from 'react'
import { useRagComparison } from '../api/use-rag-comparison'
import {
  PIPELINE_LABELS,
  PIPELINE_SHORT_LABELS,
  STRATEGY_IDS,
  STRATEGY_LABELS,
} from '../data/rag-ui'
import type { ChunkingStrategyId, StrategyComparison } from '../types'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

type Row = {
  label: string
  value: (entry: StrategyComparison) => string
}

const LEVEL_ROWS: Row[] = [
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

const METRIC_ROWS: { label: string }[] = [
  { label: 'recall@3' },
  { label: 'recall@5' },
  { label: 'MRR' },
  { label: 'precision@5' },
  { label: 'nDCG@5' },
]

function metricValue(
  entry: StrategyComparison,
  pipeline: string,
  label: string,
): string {
  const found = entry.pipelines.find((item) => item.pipeline === pipeline)
  if (!found) {
    return '—'
  }
  const stats = found.retrieval
  const values: Record<string, number> = {
    'recall@3': stats.recallAt3,
    'recall@5': stats.recallAt5,
    MRR: stats.mrr,
    'precision@5': stats.precisionAt5,
    'nDCG@5': stats.ndcgAt5,
  }
  return (values[label] ?? 0).toFixed(3)
}

export default function ComparisonPanel() {
  const [includeRewrite, setIncludeRewrite] = useState(false)
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const comparison = useRagComparison(includeRewrite)
  const entries = comparison.data?.strategies ?? []
  const selected = entries.find((entry) => entry.strategy === strategy)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Сравнение стратегий</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <p className="demo-muted m-0 text-xs">
            Retrieval-метрики посчитаны на наборе из{' '}
            {comparison.data?.queryCount ?? 0} вопросов; релевантность — на
            уровне статьи.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant={includeRewrite ? 'default' : 'secondary'}
              onClick={() => setIncludeRewrite((value) => !value)}
            >
              {includeRewrite ? 'Режимы rewrite: вкл' : 'Режимы rewrite: выкл'}
            </Button>
            <span className="demo-muted text-xs">
              rewrite-режимы вызывают LLM (переформулировка каждого вопроса)
            </span>
          </div>
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
              {LEVEL_ROWS.map((row) => (
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

      {selected && selected.pipelines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Retrieval по режимам</CardTitle>
          </CardHeader>
          <CardContent className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {STRATEGY_IDS.map((id) => (
                <Button
                  key={id}
                  size="xs"
                  variant={strategy === id ? 'default' : 'secondary'}
                  onClick={() => setStrategy(id)}
                >
                  {STRATEGY_LABELS[id]}
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                      Метрика
                    </th>
                    {selected.pipelines.map((item) => (
                      <th
                        key={item.pipeline}
                        className="border-b border-[var(--line)] px-3 py-2 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]"
                      >
                        {PIPELINE_LABELS[item.pipeline]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.map((row) => (
                    <tr key={row.label}>
                      <td className="border-b border-[var(--line)] px-3 py-2 text-[var(--ink-soft)]">
                        {row.label}
                      </td>
                      {selected.pipelines.map((item) => (
                        <td
                          key={item.pipeline}
                          className="border-b border-[var(--line)] px-3 py-2 font-semibold text-[var(--ink)]"
                        >
                          {metricValue(selected, item.pipeline, row.label)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="demo-muted m-0 text-xs">
              Режимы:{' '}
              {selected.pipelines
                .map((item) => PIPELINE_SHORT_LABELS[item.pipeline])
                .join(', ')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
