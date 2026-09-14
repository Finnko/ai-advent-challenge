import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '@lib/utils'

export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'danger'
  | 'warn'
  | 'outline'

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'border-[var(--line)] bg-[var(--surface-tint)] text-[var(--ink-muted)]',
  accent:
    'border-[color-mix(in_oklab,var(--accent)_45%,var(--line))] bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  success:
    'border-[color-mix(in_oklab,var(--positive)_40%,var(--line))] bg-[color-mix(in_oklab,var(--positive)_10%,var(--surface))] text-[var(--positive)]',
  danger:
    'border-[color-mix(in_oklab,var(--danger)_40%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]',
  warn: 'border-[color-mix(in_oklab,var(--warn)_40%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))]',
  outline: 'border-[var(--line-strong)] bg-transparent text-[var(--ink-soft)]',
}

export type BadgeProps = React.ComponentProps<'span'> & {
  variant?: BadgeVariant
  asChild?: boolean
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'span'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'

export { Badge }
