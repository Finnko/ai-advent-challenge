import { ChevronRight } from 'lucide-react'

import { cn } from '@lib/utils'
import { criterionMarkdown } from '../domain/markdown'
import type { CriterionResult, CriterionStatus } from '../types'
import CopyButton from './CopyButton'
import CriterionBadge from './CriterionBadge'

const CODE_TONE: Record<CriterionStatus, string> = {
  pass: 'text-[var(--positive)]',
  fail: 'text-[var(--danger)]',
  not_checked: 'text-[var(--warn)]',
}

const EDGE_TONE: Record<CriterionStatus, string> = {
  pass: 'border-l-transparent',
  fail: 'border-l-[var(--danger)]',
  not_checked: 'border-l-[var(--warn)]',
}

export default function CriterionCard({ result }: { result: CriterionResult }) {
  return (
    <li
      className={cn(
        'border-l-2 px-3 py-3 transition-colors hover:bg-[var(--surface-tint)]',
        EDGE_TONE[result.status],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'w-7 shrink-0 pt-0.5 font-mono text-xs font-bold',
            CODE_TONE[result.status],
          )}
        >
          {result.code}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
            <p className="m-0 w-full min-w-0 text-[13px] font-semibold leading-snug text-[var(--ink)] sm:w-auto sm:flex-1">
              {result.title}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <CriterionBadge status={result.status} />
              <CopyButton
                text={criterionMarkdown(result)}
                label={`Скопировать пункт ${result.code} в Markdown`}
              />
            </div>
          </div>
          {result.reason.length > 0 && (
            <p className="m-0 text-xs leading-relaxed text-[var(--ink-muted)]">
              {result.reason}
            </p>
          )}
          {result.findings.length > 0 && (
            <ul className="m-0 mt-0.5 list-disc pl-4 text-xs leading-relaxed text-[var(--ink-soft)] marker:text-[var(--danger)]">
              {result.findings.map((finding, position) => (
                <li key={`${position}-${finding}`}>{finding}</li>
              ))}
            </ul>
          )}
          {result.evidence.length > 0 && (
            <details className="group mt-0.5">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--accent-strong)] [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="h-3 w-3 transition-transform group-open:rotate-90"
                  strokeWidth={2}
                />
                факты ({result.evidence.length})
              </summary>
              <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 font-mono text-[11px] leading-relaxed text-[var(--ink-muted)]">
                {result.evidence.map((item) => (
                  <li key={item} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </li>
  )
}
