import { useState } from 'react'
import { describeModel } from '../data/models'
import { pickWinner, type GroupSummary } from '../domain/results'
import {
  formatLatency,
  formatLatencyDelta,
  formatMemory,
  formatSpeed,
} from './format'
import AccuracyBar from './AccuracyBar'
import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'

type ModelConfigSectionProps = {
  model: string
  rows: GroupSummary[]
  defaultConfigId: string
  defaultOpen: boolean
}

export default function ModelConfigSection({
  model,
  rows,
  defaultConfigId,
  defaultOpen,
}: ModelConfigSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const winner = pickWinner(rows)
  const baseLatency =
    rows.find((row) => row.configId === defaultConfigId)?.avgLatencyMs ?? null
  const sorted = [...rows].sort((a, b) => {
    if (b.overallAccuracy !== a.overallAccuracy) {
      return b.overallAccuracy - a.overallAccuracy
    }
    return (a.avgLatencyMs ?? 0) - (b.avgLatencyMs ?? 0)
  })

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 bg-[var(--surface-tint)] px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold text-[var(--ink)]">
            {describeModel(model).label}
          </span>
          {winner && <Badge variant="success">лучший: {winner.label}</Badge>}
        </span>
        <span className="demo-muted text-xs">
          {rows.length} конфиг. · {open ? 'свернуть' : 'развернуть'}
        </span>
      </button>
      {open && (
        <Table className="rounded-none border-0">
          <TableHeader>
            <TableRow>
              <TableHead>Конфигурация</TableHead>
              <TableHead>Точность</TableHead>
              <TableHead>Латентность</TableHead>
              <TableHead>Память</TableHead>
              <TableHead>ток/с</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const delta = formatLatencyDelta(baseLatency, row.avgLatencyMs)
              const isWinner = winner?.configId === row.configId
              const isDefault = row.configId === defaultConfigId
              return (
                <TableRow key={row.configId}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--ink)]">
                        {row.label}
                      </span>
                      {isDefault && <Badge variant="accent">дефолт</Badge>}
                      {isWinner && <Badge variant="success">лучший</Badge>}
                    </div>
                    <span className="demo-muted text-xs">
                      {row.runs} прогонов
                    </span>
                  </TableCell>
                  <TableCell>
                    <AccuracyBar value={row.overallAccuracy} />
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--ink-soft)]">
                      {formatLatency(row.avgLatencyMs)}
                    </span>
                    {delta && delta !== '=' && (
                      <span className="ml-2 text-xs text-[var(--ink-muted)]">
                        {delta}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatMemory(row.peakMemMb)}</TableCell>
                  <TableCell className="text-[var(--ink-muted)]">
                    {formatSpeed(row.avgTokensPerSecond)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
