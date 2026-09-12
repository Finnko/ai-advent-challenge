import type { SessionAccounting as SessionAccountingTotals } from '../../lib/accounting'
import { formatUsd } from '../../lib/tokens'

export default function SessionAccounting({
  totals,
}: {
  totals: SessionAccountingTotals
}) {
  if (totals.runs === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs">
      <span className="island-kicker m-0 text-[10px]">Сессия</span>
      <Stat label="prompt API" value={totals.promptTokensActual} />
      <Stat label="ответ" value={totals.responseTokens} />
      <Stat
        label="кеш"
        value={totals.cacheHitTokens}
        hint="cache-hit токены дешевле"
      />
      <Stat label="miss" value={totals.cacheMissTokens} />
      <span className="text-[var(--ink-muted)]">
        цена{' '}
        <span className="font-bold text-[var(--ink)]">
          ~{formatUsd(totals.costUsd)}
        </span>
      </span>
      {totals.summarizedMessages > 0 && (
        <span className="text-[var(--ink-muted)]">
          сжатие{' '}
          <span className="font-bold text-[var(--ink)]">
            {totals.summarizedMessages} сообщ.
          </span>
        </span>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint?: string
}) {
  return (
    <span className="text-[var(--ink-muted)]" title={hint}>
      {label}{' '}
      <span className="font-bold text-[var(--ink)]">
        {value.toLocaleString('ru-RU')}
      </span>
    </span>
  )
}
