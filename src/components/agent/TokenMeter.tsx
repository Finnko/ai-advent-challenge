type TokenMeterProps = {
  historyTokens: number
  requestTokens: number
  budget: number
  modelContext: number
}

export default function TokenMeter({
  historyTokens,
  requestTokens,
  budget,
  modelContext,
}: TokenMeterProps) {
  const total = historyTokens + requestTokens
  const ratio = total / budget
  const over = ratio > 1
  const pct = Math.min(100, Math.round(ratio * 100))
  const fillColor = over
    ? 'var(--danger)'
    : ratio > 0.8
      ? 'var(--warn)'
      : 'var(--accent)'

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">
          Токены · бюджет контекста
        </p>
        <p className="demo-muted m-0 text-xs">
          история ≈{historyTokens} + запрос ≈{requestTokens} = {total} /{' '}
          {budget} ток.
          {requestTokens > budget ? ' · запрос больше бюджета' : ''}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-valuenow={Math.min(100, Math.round(ratio * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
      <p className="demo-muted m-0 mt-1 text-[10px]">
        {over
          ? 'Промпт выше бюджета — с защитой агент урежет историю или откажет.'
          : 'Бюджет меньше реального контекста модели, чтобы показать переполнение вживую.'}{' '}
        Реальный контекст {modelContext.toLocaleString('ru-RU')} ток.
      </p>
    </div>
  )
}
