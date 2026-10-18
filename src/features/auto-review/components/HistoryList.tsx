import { RotateCw } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatTimestamp } from '../domain/format'
import { reviewMarkdown } from '../domain/markdown'
import type { ProjectSummary, ReviewRecord } from '../types'
import { REVIEW_STATUS_LABELS } from '../types'
import CopyButton from './CopyButton'
import ReviewSummary from './ReviewSummary'
import { reviewStatusVariant } from './status'

export default function HistoryList({
  project,
  reviews,
  onRerun,
  busy,
}: {
  project: ProjectSummary
  reviews: ReviewRecord[]
  onRerun: (reviewId: number) => void
  busy: boolean
}) {
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-[var(--line)] p-0">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                #{review.id}
              </span>
              <Badge variant={reviewStatusVariant(review.status)}>
                {REVIEW_STATUS_LABELS[review.status]}
              </Badge>
              <span className="text-[11px] text-[var(--ink-muted)]">
                {formatTimestamp(review.createdAt)}
              </span>
            </div>
            <ReviewSummary review={review} />
            {review.failedCodes.length > 0 && (
              <p className="m-0 text-[11px] text-[var(--ink-muted)]">
                не пройдено:{' '}
                <span className="font-mono text-[var(--danger)]">
                  {review.failedCodes.join(', ')}
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CopyButton
              text={reviewMarkdown({ project, review })}
              label={`Скопировать проверку #${review.id} в Markdown`}
            />
            <Button
              size="xs"
              variant="secondary"
              disabled={busy}
              onClick={() => onRerun(review.id)}
            >
              <RotateCw className="h-3 w-3" strokeWidth={2} />
              Проверить снова
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
