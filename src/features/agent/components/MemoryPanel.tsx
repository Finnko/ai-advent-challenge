import { useState } from 'react'
import type { MemoryLayer } from '../domain/memory/types'
import { MEMORY_LAYER_LABELS } from '../domain/memory/types'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'

type MemoryPanelProps = {
  disabled?: boolean
  lastUserMessage?: string
  onSave: (input: { scope: MemoryLayer; key: string; value: string }) => void
}

export default function MemoryPanel({
  disabled,
  lastUserMessage,
  onSave,
}: MemoryPanelProps) {
  const [scope, setScope] = useState<MemoryLayer>('long-term')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')

  const submit = () => {
    if (key.trim().length === 0 || value.trim().length === 0) {
      return
    }
    onSave({ scope, key: key.trim(), value: value.trim() })
    setKey('')
    setValue('')
  }

  return (
    <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">Запомнить явно</p>
      <p className="demo-muted m-0 mt-1 text-xs">
        Выбери слой и запиши факт вручную. Ручная запись не перетирается
        авто-извлечением.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          слой
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as MemoryLayer)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 py-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="working">
                {MEMORY_LAYER_LABELS.working}
              </SelectItem>
              <SelectItem value="long-term">
                {MEMORY_LAYER_LABELS['long-term']}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          disabled={disabled}
          placeholder="ключ (напр. предпочтение по отчётам)"
          className="h-8 py-1 text-xs"
        />
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="значение"
          className="min-h-0 py-1 text-xs"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastUserMessage && (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                setKey(deriveKey(lastUserMessage))
                setValue(lastUserMessage.slice(0, 280))
              }}
              disabled={disabled}
            >
              из последнего сообщения
            </Button>
          )}
          <Button
            size="sm"
            onClick={submit}
            disabled={
              disabled || key.trim().length === 0 || value.trim().length === 0
            }
          >
            Запомнить
          </Button>
        </div>
      </div>
    </section>
  )
}

function deriveKey(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 40 ? compact.slice(0, 40) : compact
}
