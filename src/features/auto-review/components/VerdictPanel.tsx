import type { ReactNode } from 'react'

import { countVerdicts } from '../domain/counts'
import { formatTimestamp } from '../domain/format'
import { findingsMarkdown, reviewMarkdown } from '../domain/markdown'
import type { ProjectSummary, ReviewRecord } from '../types'
import CopyButton from './CopyButton'
import VerdictBar from './VerdictBar'

export default function VerdictPanel({
  project,
  review,
  actions,
}: {
  project: ProjectSummary
  review: ReviewRecord
  actions?: ReactNode
}) {
  const counts = countVerdicts(review.results)
  const failedCodes = review.failedCodes

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-e2">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <p className="island-kicker m-0 text-[10px]">Последняя проверка</p>
          <h2 className="m-0 mt-1 text-base font-bold leading-none text-[var(--ink)]">
            Проверка #{review.id}
          </h2>
          <p className="m-0 mt-1 text-[11px] text-[var(--ink-muted)]">
            {formatTimestamp(review.createdAt)}
            {review.resumedFrom ? ` · повторная по #${review.resumedFrom}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <CopyButton
            text={reviewMarkdown({ project, review })}
            label="Скопировать отчёт в Markdown"
          />
          <CopyButton
            text={findingsMarkdown(review.results)}
            label="Скопировать только замечания в Markdown"
          />
          {actions}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums text-[var(--ink)]">
            {counts.passed}
          </span>
          <span className="text-lg font-semibold leading-none text-[var(--ink-muted)]">
            / {counts.total}
          </span>
          <span className="text-xs text-[var(--ink-muted)]">
            пунктов пройдено
          </span>
        </div>

        <VerdictBar counts={counts} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-[var(--positive)]">
            пройдено {counts.passed}
          </span>
          <span className="text-[var(--danger)]">
            не пройдено {counts.failed}
          </span>
          {counts.notChecked > 0 && (
            <span className="text-[var(--warn)]">
              не проверено {counts.notChecked}
            </span>
          )}
        </div>

        {failedCodes.length > 0 && (
          <p className="m-0 text-xs text-[var(--ink-soft)]">
            Не пройдено:{' '}
            <span className="font-mono font-semibold text-[var(--danger)]">
              {failedCodes.join(', ')}
            </span>
          </p>
        )}

        {review.status === 'running' && (
          <p className="m-0 text-xs text-[var(--ink-muted)]">
            Проверка идёт — отчёт обновится по завершении.
          </p>
        )}

        {review.status === 'cancelled' && (
          <p className="m-0 rounded-lg border border-[color-mix(in_oklab,var(--warn)_34%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_9%,var(--surface))] px-3 py-2 text-xs leading-relaxed text-[var(--ink-soft)]">
            Проверка прервана — отчёт неполный. Запустите повторную проверку,
            чтобы пройти её заново.
          </p>
        )}
      </div>
    </section>
  )
}
