type SummaryPanelProps = {
  summary: string
  summarizedMessages: number
  throughMessageId: number | null
  onClear?: () => void
}

export default function SummaryPanel({
  summary,
  summarizedMessages,
  throughMessageId,
  onClear,
}: SummaryPanelProps) {
  return (
    <div className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Сводка истории</p>
        <p className="demo-muted m-0 text-[10px]">
          покрывает {summarizedMessages} сообщ.
          {throughMessageId ? ` до #${throughMessageId}` : ''} · в запрос уходит
          вместо полной истории
        </p>
      </div>
      <p className="m-0 mt-1 whitespace-pre-wrap text-xs text-[var(--ink-soft)]">
        {summary}
      </p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="demo-button demo-button-secondary mt-2 px-2 py-0.5 text-[10px]"
        >
          скрыть
        </button>
      )}
    </div>
  )
}
