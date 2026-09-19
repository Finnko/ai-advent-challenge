import Tile from './Tile'

type TokenReportProps = {
  requestTokens: number
  historyTokens: number
  historyTokensSent: number | null
  responseTokens: number | null
  contextTokens: number | null
}

export default function TokenReport({
  requestTokens,
  historyTokens,
  historyTokensSent,
  responseTokens,
  contextTokens,
}: TokenReportProps) {
  const historyNote =
    historyTokensSent === null
      ? 'копится по ходу диалога'
      : `в последнем ходу отправлено ≈${historyTokensSent}`

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-4"
      aria-label="Токены последнего хода"
    >
      <Tile
        label="Текущий запрос"
        value={requestTokens}
        note="оценка по тексту в поле"
      />
      <Tile label="История диалога" value={historyTokens} note={historyNote} />
      <Tile
        label="Контекст"
        value={contextTokens ?? 0}
        note={
          contextTokens && contextTokens > 0
            ? 'уходит вместо старой истории'
            : 'контекст-блока пока нет'
        }
      />
      <Tile
        label="Ответ модели"
        value={responseTokens}
        note={
          responseTokens === null ? 'ещё не было ответа' : 'реальные токены API'
        }
        estimate={false}
      />
    </div>
  )
}
