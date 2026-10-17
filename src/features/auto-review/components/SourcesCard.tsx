import { Button } from '@/components/ui/Button'

function sourcesNote(present: boolean, owned: boolean): string {
  if (!present) {
    return 'Исходников нет: архив и распакованная копия удалены.'
  }
  if (owned) {
    return 'Загруженный архив распакован в рабочую папку сервиса.'
  }
  return 'Проект подключён по пути на диске: файлы остаются у вас, сервис их не удаляет.'
}

export default function SourcesCard({
  present,
  owned,
  busy,
  dropHistory,
  onDropHistoryChange,
  onCleanup,
}: {
  present: boolean
  owned: boolean
  busy: boolean
  dropHistory: boolean
  onDropHistoryChange: (value: boolean) => void
  onCleanup: () => void
}) {
  const forget = present && !owned
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 max-w-[65ch] text-xs leading-relaxed text-[var(--ink-muted)]">
        {sourcesNote(present, owned)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={forget ? 'secondary' : 'danger'}
          disabled={!present || busy}
          onClick={onCleanup}
        >
          {forget ? 'Забыть папку на диске' : 'Удалить исходники'}
        </Button>
        {present && (
          <label className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--accent)]"
              checked={dropHistory}
              onChange={(event) => onDropHistoryChange(event.target.checked)}
            />
            вместе с историей проверок
          </label>
        )}
      </div>
    </div>
  )
}
