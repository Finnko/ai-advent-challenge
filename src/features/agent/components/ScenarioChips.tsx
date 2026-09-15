import { Button } from '@/components/ui/Button'

type ScenarioChipsProps = {
  messages: string[]
  index: number
  disabled?: boolean
  onPick: (text: string) => void
}

export default function ScenarioChips({
  messages,
  index,
  disabled,
  onPick,
}: ScenarioChipsProps) {
  const done = index >= messages.length
  const next = done ? null : messages[index]

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => next && onPick(next)}
        disabled={disabled || done}
        title={next ?? 'Сценарий пройден'}
      >
        {done
          ? 'Сценарий пройден'
          : `Следующее сообщение сценария (${index + 1}/${messages.length})`}
      </Button>
      {next && (
        <span className="demo-muted min-w-0 flex-1 truncate text-xs">
          {next}
        </span>
      )}
    </div>
  )
}
