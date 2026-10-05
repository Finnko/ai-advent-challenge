import { useState } from 'react'
import type { MemoryEntry, MemoryLayer } from '../domain/memory/types'
import { DIALOGUE_MEMORY_PREFIX } from '../domain/memory/router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export type DialogueSaveInput = {
  scope: MemoryLayer
  key: string
  value: string
}

function shortKey(key: string): string {
  return key.slice(DIALOGUE_MEMORY_PREFIX.length)
}

export default function DialogueMemoryRow({
  entry,
  disabled,
  onSave,
  onForget,
}: {
  entry: MemoryEntry
  disabled?: boolean
  onSave: (input: DialogueSaveInput) => void
  onForget: (scope: MemoryLayer, key: string) => void
}) {
  const [value, setValue] = useState(entry.value)
  return (
    <div className="flex items-center gap-2">
      <span className="w-[120px] shrink-0 truncate text-xs font-semibold text-ink-muted">
        {shortKey(entry.key)}
      </span>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className="h-8 py-1 text-xs"
      />
      <Button
        variant="secondary"
        size="xs"
        disabled={disabled || value.trim().length === 0}
        onClick={() =>
          onSave({ scope: 'working', key: entry.key, value: value.trim() })
        }
      >
        Сохранить
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={() => onForget('working', entry.key)}
      >
        Удалить
      </Button>
    </div>
  )
}
