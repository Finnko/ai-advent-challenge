import { useState } from 'react'
import type { MemoryEntry } from '../domain/memory/types'
import { DIALOGUE_MEMORY_PREFIX } from '../domain/memory/router'
import DialogueMemoryRow from './DialogueMemoryRow'
import type { DialogueSaveInput } from './DialogueMemoryRow'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function dialogueEntries(entries: MemoryEntry[]): MemoryEntry[] {
  return entries.filter((entry) =>
    entry.key.toLowerCase().startsWith(DIALOGUE_MEMORY_PREFIX),
  )
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export default function DialogueMemoryPanel({
  working,
  disabled,
  onSave,
  onForget,
}: {
  working: MemoryEntry[]
  disabled?: boolean
  onSave: (input: DialogueSaveInput) => void
  onForget: (scope: 'working' | 'long-term', key: string) => void
}) {
  const entries = dialogueEntries(working).sort((a, b) =>
    a.key.localeCompare(b.key),
  )
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  const add = () => {
    const key = `${DIALOGUE_MEMORY_PREFIX}${slug(label)}`
    if (key === DIALOGUE_MEMORY_PREFIX || value.trim().length === 0) {
      return
    }
    onSave({ scope: 'working', key, value: value.trim() })
    setLabel('')
    setValue('')
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">Память задачи диалога</p>
      <p className="demo-muted m-0 mt-1 text-xs">
        Цель, ограничения и термины диалога (ключи{' '}
        <code>{DIALOGUE_MEMORY_PREFIX}…</code>). Заполняется автоматически;
        ручная правка не перетирается.
      </p>
      {entries.length === 0 ? (
        <p className="demo-muted m-0 mt-2 text-xs">
          Пока пусто — появится по ходу диалога.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map((entry) => (
            <DialogueMemoryRow
              key={entry.key}
              entry={entry}
              disabled={disabled}
              onSave={onSave}
              onForget={onForget}
            />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          disabled={disabled}
          placeholder="поле (напр. goal, term:регион)"
          className="h-8 py-1 text-xs"
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          placeholder="значение"
          className="h-8 py-1 text-xs"
        />
        <Button
          size="xs"
          disabled={disabled || value.trim().length === 0}
          onClick={add}
        >
          Добавить
        </Button>
      </div>
    </section>
  )
}
