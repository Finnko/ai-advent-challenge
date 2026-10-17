import { Badge } from '@/components/ui/Badge'
import { countVerdicts } from '../domain/counts'
import type { ReviewRecord } from '../types'
import VerdictBar from './VerdictBar'

export default function ReviewSummary({ review }: { review: ReviewRecord }) {
  const counts = countVerdicts(review.results)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="text-[var(--positive)]">пройдено {counts.passed}</span>
        <span className="text-[var(--danger)]">
          не пройдено {counts.failed}
        </span>
        {counts.notChecked > 0 && (
          <span className="text-[var(--warn)]">
            не проверено {counts.notChecked}
          </span>
        )}
        <span className="ml-auto font-mono tabular-nums text-[var(--ink-muted)]">
          {counts.passed} / {counts.total}
        </span>
      </div>
      <VerdictBar counts={counts} className="h-1.5" />
      {review.resumedFrom && (
        <Badge variant="accent" className="text-[11px]">
          повторная по #{review.resumedFrom}
        </Badge>
      )}
    </div>
  )
}
