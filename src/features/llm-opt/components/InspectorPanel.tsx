import { useMemo, useState } from 'react'
import { findDoc } from '../data/dataset'
import type { FieldId } from '../domain/extraction'
import type { StoredRun } from '../domain/results'
import { Badge } from '@/components/ui/Badge'

type InspectorPanelProps = {
  runs: StoredRun[]
  fieldLabels: Record<FieldId, string>
}

export default function InspectorPanel({
  runs,
  fieldLabels,
}: InspectorPanelProps) {
  const groups = useMemo(() => {
    const keys = new Map<
      string,
      { model: string; configId: string; label: string }
    >()
    for (const run of runs) {
      const key = `${run.model}::${run.config.id}`
      if (!keys.has(key)) {
        keys.set(key, {
          model: run.model,
          configId: run.config.id,
          label: run.config.label,
        })
      }
    }
    return [...keys.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [runs])

  const [selected, setSelected] = useState<string>('')
  const activeKey = selected || groups[0]?.key || ''
  const groupRuns = runs
    .filter((run) => `${run.model}::${run.config.id}` === activeKey)
    .sort((a, b) =>
      a.docId === b.docId
        ? a.repeat - b.repeat
        : a.docId.localeCompare(b.docId),
    )

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={activeKey}
        onChange={(event) => setSelected(event.target.value)}
        className="h-9 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink-soft)]"
      >
        {groups.map((group) => (
          <option key={group.key} value={group.key}>
            {group.label} · {group.model}
          </option>
        ))}
      </select>

      {groupRuns.map((run) => {
        const doc = findDoc(run.docId)
        return (
          <div
            key={run.id}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--ink)]">
                {doc?.title ?? run.docId}
              </span>
              <Badge variant={run.valid ? 'success' : 'danger'}>
                {run.fields.filter((field) => field.correct).length}/
                {run.fields.length}
              </Badge>
              {run.repeat > 0 && (
                <Badge variant="outline">повтор {run.repeat + 1}</Badge>
              )}
              <Badge variant={run.format === 'json' ? 'accent' : 'warn'}>
                {run.format}
              </Badge>
            </div>
            <div className="mb-2 flex flex-col gap-1">
              {run.fields.map((field) => (
                <div key={field.field} className="flex flex-wrap gap-2 text-xs">
                  <span className="demo-muted">
                    {fieldLabels[field.field]}:
                  </span>
                  <span className="text-[var(--ink)]">
                    {field.expected || '—'}
                  </span>
                  <span
                    className={
                      field.correct
                        ? 'text-[var(--positive)]'
                        : 'text-[var(--danger)]'
                    }
                  >
                    {field.correct ? '✓' : '✗'} {field.actual || 'пусто'}
                  </span>
                </div>
              ))}
            </div>
            {doc && <p className="demo-muted m-0 mb-2 text-xs">{doc.core}</p>}
            <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 text-xs text-[var(--ink-soft)]">
              {run.raw || '— пустой ответ —'}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
