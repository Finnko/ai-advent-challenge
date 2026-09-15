import type { MemoryLayer } from '../domain/memory/types'
import type { MemoryItem } from '../types'
import { memoryLayerLabel } from '../data/day11'
import { memorySourceLabel } from '../domain/memory/read'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type MemoryInspectorProps = {
  working: MemoryItem[]
  longTerm: MemoryItem[]
  shortTermCount: number
  disabled?: boolean
  onForget: (scope: MemoryLayer, key: string) => void
}

export default function MemoryInspector({
  working,
  longTerm,
  shortTermCount,
  disabled,
  onForget,
}: MemoryInspectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <ShortTermSection count={shortTermCount} />
      <LayerSection
        scope="working"
        entries={working}
        disabled={disabled}
        onForget={onForget}
      />
      <LayerSection
        scope="long-term"
        entries={longTerm}
        disabled={disabled}
        onForget={onForget}
      />
    </div>
  )
}

function ShortTermSection({ count }: { count: number }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Краткосрочная · диалог</p>
        <Badge>{count} сообщ.</Badge>
      </div>
      <p className="demo-muted m-0 mt-2 text-xs">
        Последние сообщения активной ветки (стратегия «скользящее окно»). Хранятся
        в таблице messages и не переживают сессию.
      </p>
    </section>
  )
}

function LayerSection({
  scope,
  entries,
  disabled,
  onForget,
}: {
  scope: MemoryLayer
  entries: MemoryItem[]
  disabled?: boolean
  onForget: (scope: MemoryLayer, key: string) => void
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">
          {memoryLayerLabel(scope)} · {scope}
        </p>
        <Badge>{entries.length}</Badge>
      </div>
      {entries.length === 0 ? (
        <p className="demo-muted m-0 mt-2 text-xs">
          Слой пуст — данные появятся после ходов агента или ручной записи.
        </p>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-xs">
          {entries.map((entry) => (
            <li
              key={entry.key}
              className="flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="font-semibold text-[var(--ink-soft)]">
                  {entry.key}
                </span>
                <span className="text-[var(--ink-muted)]">: {entry.value}</span>
                <span className="demo-muted ml-1 text-[10px]">
                  · {memorySourceLabel(entry.source)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => onForget(scope, entry.key)}
                disabled={disabled}
                title="Забыть эту запись"
              >
                забыть
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
