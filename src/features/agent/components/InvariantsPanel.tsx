import { useState } from 'react'
import type { InvariantInput, InvariantRecord, InvariantUpdateInput } from '../domain/invariants/types'
import { CATEGORY_LABELS, invariantCode } from '../domain/invariants/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import InvariantEditor from './InvariantEditor'

type Props = { invariants: InvariantRecord[]; disabled?: boolean; onCreate: (input: InvariantInput) => void; onUpdate: (id: number, input: InvariantUpdateInput) => void; onDelete: (id: number) => void }

export default function InvariantsPanel({ invariants, disabled, onCreate, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<InvariantRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const save = (input: InvariantInput | InvariantUpdateInput) => {
    if (creating) {
      onCreate(input as InvariantInput)
    } else if (editing) {
      onUpdate(editing.id, {
        category: input.category,
        title: input.title,
        text: input.text,
        check: input.check,
      })
    }
    setCreating(false)
    setEditing(null)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2"><div><p className="island-kicker m-0 text-[10px]">Глобальный набор правил</p><p className="demo-muted m-0 mt-1 text-xs">Инварианты действуют для всех сессий выбранного пользователя.</p></div><Button variant="secondary" size="xs" onClick={() => { setCreating(true); setEditing(null) }} disabled={disabled}>+ новое правило</Button></div>
      {(creating || editing) && <InvariantEditor key={editing?.id ?? 'new'} invariant={editing} disabled={disabled} onSave={save} onCancel={() => { setCreating(false); setEditing(null) }} />}
      {invariants.length === 0 ? <p className="demo-muted m-0 text-xs">Правил пока нет.</p> : <div className="grid grid-cols-1 gap-2">{invariants.map((invariant) => <article key={invariant.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"><div className="flex flex-wrap items-center gap-1.5"><Badge variant="accent">{invariantCode(invariant)}</Badge><Badge>{CATEGORY_LABELS[invariant.category]}</Badge>{invariant.pinned && <Badge variant="warn">pinned</Badge>}<span className="text-sm font-bold text-[var(--ink)]">{invariant.title}</span></div><p className="demo-muted m-0 mt-2 whitespace-pre-wrap text-xs">{invariant.text}</p><div className="mt-2 flex items-center gap-1.5"><Button variant="ghost" size="xs" onClick={() => { setEditing(invariant); setCreating(false) }} disabled={disabled}>изменить</Button>{!invariant.pinned && <Button variant="ghost" size="xs" onClick={() => onDelete(invariant.id)} disabled={disabled}>удалить</Button>}</div></article>)}</div>}
    </div>
  )
}
