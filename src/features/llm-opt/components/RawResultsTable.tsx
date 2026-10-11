import { useMemo, useState } from 'react'
import { describeModel } from '../data/models'
import type { FieldId } from '../domain/extraction'
import type { GroupSummary } from '../domain/results'
import {
  formatLatency,
  formatMemory,
  formatPercent,
  formatSpeed,
} from './format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import SortButton from './SortButton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'

type RawResultsTableProps = {
  summaries: GroupSummary[]
  winnerKeys: string[]
  defaultConfigId: string
  fields: FieldId[]
  fieldLabels: Record<FieldId, string>
}

type SortKey =
  'model' | 'config' | 'full' | 'json' | 'latency' | 'speed' | 'mem'

function rowKey(summary: GroupSummary): string {
  return `${summary.model}::${summary.configId}`
}

function sortValue(summary: GroupSummary, key: SortKey): string | number {
  if (key === 'model') {
    return describeModel(summary.model).label
  }
  if (key === 'config') {
    return summary.label
  }
  if (key === 'full') {
    return summary.fullMatchRate
  }
  if (key === 'json') {
    return summary.jsonRate
  }
  if (key === 'latency') {
    return summary.avgLatencyMs ?? Number.POSITIVE_INFINITY
  }
  if (key === 'speed') {
    return summary.avgTokensPerSecond ?? -1
  }
  return summary.peakMemMb ?? Number.POSITIVE_INFINITY
}

function isInteresting(
  summary: GroupSummary,
  defaultConfigId: string,
  winnerKeys: string[],
): boolean {
  if (summary.configId === defaultConfigId) {
    return true
  }
  if (winnerKeys.includes(rowKey(summary))) {
    return true
  }
  return (
    summary.overallAccuracy < 1 ||
    summary.fullMatchRate < 1 ||
    summary.jsonRate < 1
  )
}

function toCsv(
  summaries: GroupSummary[],
  fields: FieldId[],
  fieldLabels: Record<FieldId, string>,
): string {
  const header = [
    'модель',
    'конфигурация',
    ...fields.map((field) => fieldLabels[field]),
    'полный JSON',
    'валидный JSON',
    'латентность, с',
    'ток/с',
    'память, ГБ',
  ]
  const lines = summaries.map((summary) =>
    [
      describeModel(summary.model).label,
      summary.label,
      ...fields.map((field) => formatPercent(summary.fieldAccuracy[field])),
      formatPercent(summary.fullMatchRate),
      formatPercent(summary.jsonRate),
      summary.avgLatencyMs === null
        ? ''
        : (summary.avgLatencyMs / 1000).toFixed(1),
      summary.avgTokensPerSecond?.toFixed(1) ?? '',
      summary.peakMemMb === null ? '' : (summary.peakMemMb / 1024).toFixed(1),
    ].join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export default function RawResultsTable({
  summaries,
  winnerKeys,
  defaultConfigId,
  fields,
  fieldLabels,
}: RawResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('model')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => {
    const filtered = onlyDiff
      ? summaries.filter((summary) =>
          isInteresting(summary, defaultConfigId, winnerKeys),
        )
      : summaries
    const sorted = [...filtered].sort((a, b) => {
      const left = sortValue(a, sortKey)
      const right = sortValue(b, sortKey)
      if (left < right) {
        return sortDir === 'asc' ? -1 : 1
      }
      if (left > right) {
        return sortDir === 'asc' ? 1 : -1
      }
      return 0
    })
    return sorted
  }, [summaries, sortKey, sortDir, onlyDiff, defaultConfigId, winnerKeys])

  if (summaries.length === 0) {
    return (
      <p className="demo-muted m-0 text-sm">
        Пока нет прогонов. Выбери конфигурации и запусти sweep.
      </p>
    )
  }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(rows, fields, fieldLabels))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const headClass =
    'text-xs font-bold uppercase tracking-wide text-[var(--ink)]'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="demo-muted flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlyDiff}
            onChange={(event) => setOnlyDiff(event.target.checked)}
          />
          Только отличия от «
          {summaries.find((s) => s.configId === defaultConfigId)?.label ??
            'дефолт'}
          »
        </label>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? 'Скопировано' : 'Копировать CSV'}
        </Button>
        <span className="demo-muted text-xs">{rows.length} строк</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={`${headClass} sticky left-0 z-10`}>
              <SortButton
                label="Конфигурация"
                active={sortKey === 'config'}
                direction={sortDir}
                onClick={() => toggleSort('config')}
              />
            </TableHead>
            <TableHead className={headClass}>
              <SortButton
                label="Модель"
                active={sortKey === 'model'}
                direction={sortDir}
                onClick={() => toggleSort('model')}
              />
            </TableHead>
            {fields.map((field) => (
              <TableHead key={field} className={`${headClass} text-right`}>
                {fieldLabels[field]}
              </TableHead>
            ))}
            <TableHead className={`${headClass} text-right`}>
              <SortButton
                label="Полный JSON"
                active={sortKey === 'full'}
                direction={sortDir}
                align="right"
                onClick={() => toggleSort('full')}
              />
            </TableHead>
            <TableHead className={`${headClass} text-right`}>
              <SortButton
                label="Валидный JSON"
                active={sortKey === 'json'}
                direction={sortDir}
                align="right"
                onClick={() => toggleSort('json')}
              />
            </TableHead>
            <TableHead className={`${headClass} text-right`}>
              <SortButton
                label="Латентность"
                active={sortKey === 'latency'}
                direction={sortDir}
                align="right"
                onClick={() => toggleSort('latency')}
              />
            </TableHead>
            <TableHead className={`${headClass} text-right`}>
              <SortButton
                label="ток/с"
                active={sortKey === 'speed'}
                direction={sortDir}
                align="right"
                onClick={() => toggleSort('speed')}
              />
            </TableHead>
            <TableHead className={`${headClass} text-right`}>
              <SortButton
                label="Память"
                active={sortKey === 'mem'}
                direction={sortDir}
                align="right"
                onClick={() => toggleSort('mem')}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((summary) => {
            const isWinner = winnerKeys.includes(rowKey(summary))
            const isDefault = summary.configId === defaultConfigId
            return (
              <TableRow key={rowKey(summary)}>
                <TableCell className="sticky left-0 z-10 bg-[var(--surface)]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--ink)]">
                      {summary.label}
                    </span>
                    {isWinner && <Badge variant="success">лучший</Badge>}
                    {isDefault && <Badge variant="accent">дефолт</Badge>}
                  </div>
                  <span className="demo-muted text-xs">
                    {summary.runs} прогонов
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {describeModel(summary.model).label}
                </TableCell>
                {fields.map((field) => (
                  <TableCell
                    key={field}
                    className="text-right tabular-nums text-[var(--ink-soft)]"
                  >
                    {formatPercent(summary.fieldAccuracy[field])}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums font-semibold text-[var(--ink)]">
                  {formatPercent(summary.fullMatchRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-[var(--ink-soft)]">
                  {formatPercent(summary.jsonRate)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-[var(--ink-soft)]">
                  {formatLatency(summary.avgLatencyMs)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-[var(--ink-soft)]">
                  {formatSpeed(summary.avgTokensPerSecond)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-[var(--ink-soft)]">
                  {formatMemory(summary.peakMemMb)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
