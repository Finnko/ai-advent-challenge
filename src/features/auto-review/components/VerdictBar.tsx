import { cn } from '@lib/utils'
import type { VerdictCounts } from '../domain/counts'

export default function VerdictBar({
  counts,
  className,
}: {
  counts: VerdictCounts
  className?: string
}) {
  if (counts.total === 0) {
    return (
      <div
        className={cn(
          'h-2 w-full rounded-full bg-[var(--surface-tint)]',
          className,
        )}
        aria-hidden
      />
    )
  }
  const percent = (value: number) => `${(value / counts.total) * 100}%`
  return (
    <div
      className={cn(
        'flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-tint)]',
        className,
      )}
      role="img"
      aria-label={`пройдено ${counts.passed}, не пройдено ${counts.failed}, не проверено ${counts.notChecked}`}
    >
      {counts.passed > 0 && (
        <span
          className="h-full bg-[var(--positive)]"
          style={{ width: percent(counts.passed) }}
        />
      )}
      {counts.failed > 0 && (
        <span
          className="h-full bg-[var(--danger)]"
          style={{ width: percent(counts.failed) }}
        />
      )}
      {counts.notChecked > 0 && (
        <span
          className="h-full bg-[var(--warn)]"
          style={{ width: percent(counts.notChecked) }}
        />
      )}
    </div>
  )
}
