import { cn } from '@lib/utils'

export default function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block animate-pulse rounded-md bg-[var(--surface-tint)]',
        className,
      )}
    />
  )
}
