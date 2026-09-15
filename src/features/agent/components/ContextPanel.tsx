import type { ContextNote } from '../domain/agent'
import { Button } from '@/components/ui/Button'

type ContextPanelProps = {
  note: ContextNote
  onClear?: () => void
}

export default function ContextPanel({ note, onClear }: ContextPanelProps) {
  return (
    <div className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">{note.label}</p>
        <p className="demo-muted m-0 text-[10px]">
          покрывает {note.messages} сообщ.
          {note.throughMessageId ? ` до #${note.throughMessageId}` : ''} · в запрос
          уходит вместо полной истории
        </p>
      </div>
      <p className="m-0 mt-1 whitespace-pre-wrap text-xs text-[var(--ink-soft)]">
        {note.text}
      </p>
      {onClear && (
        <Button
          variant="secondary"
          size="xs"
          className="mt-2"
          onClick={onClear}
        >
          скрыть
        </Button>
      )}
    </div>
  )
}
