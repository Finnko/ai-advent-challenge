import type { FactItem } from '../types'
import { Badge } from '@/components/ui/Badge'

type FactsPanelProps = {
  facts: FactItem[]
}

export default function FactsPanel({ facts }: FactsPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Факты диалога</p>
        <Badge>{facts.length}</Badge>
      </div>
      {facts.length === 0 ? (
        <p className="demo-muted m-0 mt-2 text-xs">
          Стратегия «Факты» заполнит таблицу после первого хода.
        </p>
      ) : (
        <dl className="m-0 mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs">
          {facts.map((fact) => (
            <div key={fact.key} className="flex gap-2">
              <dt className="shrink-0 font-semibold text-[var(--ink-soft)]">
                {fact.key}
              </dt>
              <dd className="m-0 text-[var(--ink-muted)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
