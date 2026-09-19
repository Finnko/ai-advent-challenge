import { useState } from 'react'
import type { InvariantCategory, InvariantInput, InvariantRecord, InvariantUpdateInput } from '../domain/invariants/types'
import { CATEGORY_LABELS, INVARIANT_CATEGORIES, invariantCheckIds } from '../domain/invariants/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

type Props = {
  invariant: InvariantRecord | null
  disabled?: boolean
  onSave: (input: InvariantInput | InvariantUpdateInput) => void
  onCancel: () => void
}

function toForm(invariant: InvariantRecord | null): InvariantInput {
  return {
    slug: invariant?.slug ?? '',
    category: invariant?.category ?? 'business',
    title: invariant?.title ?? '',
    text: invariant?.text ?? '',
    check: invariant?.check ?? null,
  }
}

export default function InvariantEditor({ invariant, disabled, onSave, onCancel }: Props) {
  const [form, setForm] = useState<InvariantInput>(() => toForm(invariant))
  const set = <K extends keyof InvariantInput>(key: K, value: InvariantInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const pinned = invariant?.pinned ?? false
  return (
    <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">{invariant ? 'Редактирование правила' : 'Новое правило'}</p>
      <div className="mt-3 flex flex-col gap-2">
        <label className="demo-muted flex flex-col gap-1 text-[11px]">slug
          <Input value={form.slug} disabled={disabled || Boolean(invariant)} onChange={(event) => set('slug', event.target.value)} maxLength={80} className="h-8 py-1 text-xs" />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="demo-muted flex flex-col gap-1 text-[11px]">категория
            <Select value={form.category} onValueChange={(value) => set('category', value as InvariantCategory)} disabled={disabled}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{INVARIANT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{CATEGORY_LABELS[category]}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="demo-muted flex flex-col gap-1 text-[11px]">проверка
            <Select value={form.check ?? 'none'} onValueChange={(value) => set('check', value === 'none' ? null : value as InvariantInput['check'])} disabled={disabled || pinned}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">только prompt</SelectItem>{invariantCheckIds.map((check) => <SelectItem key={check} value={check}>{check}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <label className="demo-muted flex flex-col gap-1 text-[11px]">заголовок
          <Input value={form.title} disabled={disabled} onChange={(event) => set('title', event.target.value)} maxLength={120} className="h-8 py-1 text-xs" />
        </label>
        <label className="demo-muted flex flex-col gap-1 text-[11px]">текст правила
          <Textarea value={form.text} disabled={disabled} onChange={(event) => set('text', event.target.value)} maxLength={500} rows={4} className="min-h-0 py-1 text-xs" />
        </label>
        {pinned && <p className="demo-muted m-0 text-[11px]">Закреплённое правило: slug и проверка фиксированы, категорию, название и текст можно редактировать.</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={onCancel} disabled={disabled}>Отмена</Button><Button size="sm" onClick={() => onSave(form)} disabled={disabled || !form.title.trim() || !form.text.trim() || !form.slug.trim()}>Сохранить</Button></div>
      </div>
    </section>
  )
}
