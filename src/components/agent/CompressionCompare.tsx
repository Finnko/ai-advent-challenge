import type { AgentRunResult } from '../../lib/agent'
import type { CompressionComparison } from '../../lib/api'
import { summaryCostUsd } from '../../lib/accounting'
import { formatUsd } from '../../lib/tokens'

type CompressionCompareProps = {
  canCompare: boolean
  running: boolean
  disabled: boolean
  result: CompressionComparison | null
  error: string | null
  onCompare: () => void
}

export default function CompressionCompare({
  canCompare,
  running,
  disabled,
  result,
  error,
  onCompare,
}: CompressionCompareProps) {
  const summaryExpense = result?.auxUsage
    ? summaryCostUsd(result.auxUsage)
    : 0
  const compressedTotal =
    (result?.compressed.tokens.costUsd ?? 0) + summaryExpense
  const saved = (result?.plain.tokens.costUsd ?? 0) - compressedTotal

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="island-kicker m-0 text-[10px]">
            A/B: сжатие против полной истории
          </p>
          <p className="demo-muted m-0 text-[10px]">
            Один запрос прогоняется дважды; ничего не сохраняется.
          </p>
        </div>
        <button
          type="button"
          onClick={onCompare}
          disabled={!canCompare || running || disabled}
          className="demo-button demo-button-secondary px-3 py-1 text-xs"
        >
          {running ? 'Сравниваю…' : 'Сравнить'}
        </button>
      </div>

      {!canCompare && (
        <p className="demo-muted m-0 mt-1 text-[10px]">
          Нужна сессия с историей и непустой запрос в поле ниже.
        </p>
      )}

      {error && (
        <p className="demo-alert demo-alert-danger m-0 mt-2 text-xs">{error}</p>
      )}

      {result && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ComparisonCard
              title="Со сжатием"
              tone="accent"
              run={result.compressed}
              extra={summaryExpense}
              extraNote={
                result.auxUsage
                  ? 'включая стоимость суммаризатора'
                  : 'сводка уже была'
              }
            />
            <ComparisonCard title="Без сжатия" run={result.plain} />
          </div>
          <p className="m-0 text-xs">
            {saved >= 0 ? (
              <span className="text-[var(--positive)]">
                Экономия ~{formatUsd(saved)} на этом запросе
              </span>
            ) : (
              <span className="text-[var(--danger)]">
                Сжатие дороже на ~{formatUsd(-saved)} (суммаризатор + кеш)
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function ComparisonCard({
  title,
  run,
  tone,
  extra = 0,
  extraNote,
}: {
  title: string
  run: AgentRunResult
  tone?: 'accent'
  extra?: number
  extraNote?: string
}) {
  const t = run.tokens
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === 'accent'
          ? 'border-[color-mix(in_oklab,var(--accent)_40%,var(--line))]'
          : 'border-[var(--line)]'
      }`}
    >
      <p className="m-0 text-xs font-bold text-[var(--ink)]">{title}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-[var(--ink-muted)]">
        <Line label="prompt API" value={t.promptTokensActual} />
        <Line label="история отправлена" value={t.historyTokensSent} />
        {t.contextTokens > 0 && (
          <Line label="контекст" value={t.contextTokens} />
        )}
        <Line label="ответ" value={t.responseTokens} />
        <Line
          label="cache hit / miss"
          raw={`${t.cacheHitTokens} / ${t.cacheMissTokens}`}
        />
        <Line
          label="цена"
          raw={`~${formatUsd(t.costUsd + extra)}`}
          note={extra > 0 ? extraNote : undefined}
        />
      </div>
      <p className="m-0 mt-2 line-clamp-4 whitespace-pre-wrap border-t border-[var(--line)] pt-2 text-[11px] text-[var(--ink-soft)]">
        {run.answer}
      </p>
    </div>
  )
}

function Line({
  label,
  value,
  raw,
  note,
}: {
  label: string
  value?: number
  raw?: string
  note?: string
}) {
  return (
    <span>
      {label}{' '}
      <span className="font-bold text-[var(--ink)]">
        {raw ?? value?.toLocaleString('ru-RU')}
      </span>
      {note && <span className="text-[var(--ink-muted)]"> · {note}</span>}
    </span>
  )
}
