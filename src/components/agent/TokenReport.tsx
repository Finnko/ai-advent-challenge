type TokenReportProps = {
  requestTokens: number
  historyTokens: number
  historyTokensSent: number | null
  responseTokens: number | null
}

export default function TokenReport({
  requestTokens,
  historyTokens,
  historyTokensSent,
  responseTokens,
}: TokenReportProps) {
  const historyNote =
    historyTokensSent === null
      ? 'копится по ходу диалога'
      : historyTokensSent === historyTokens
        ? 'вся история уйдёт в API'
        : `в последнем ходу отправлено ≈${historyTokensSent}`

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      aria-label="Токены последнего хода"
    >
      <Tile
        label="Текущий запрос"
        value={requestTokens}
        note="оценка по тексту в поле"
      />
      <Tile label="История диалога" value={historyTokens} note={historyNote} />
      <Tile
        label="Ответ модели"
        value={responseTokens}
        note={responseTokens === null ? 'ещё не было ответа' : 'реальные токены API'}
        estimate={false}
      />
    </div>
  )
}

function Tile({
  label,
  value,
  note,
  estimate = true,
}: {
  label: string
  value: number | null
  note: string
  estimate?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">{label}</p>
      <p className="m-0 mt-1 text-xl font-extrabold tracking-tight text-[var(--ink)]">
        {value === null
          ? '—'
          : `${estimate ? '≈' : ''}${value.toLocaleString('ru-RU')}`}
        <span className="ml-1 text-xs font-semibold text-[var(--ink-muted)]">
          ток.
        </span>
      </p>
      <p className="demo-muted m-0 text-[10px]">{note}</p>
    </div>
  )
}
