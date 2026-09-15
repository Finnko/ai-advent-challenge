import * as React from 'react'

import { cn } from '@lib/utils'

export type AlertVariant = 'default' | 'destructive'

const variantClasses: Record<AlertVariant, string> = {
  default:
    'border-[color-mix(in_oklab,var(--warn)_34%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_11%,var(--surface))] text-[var(--ink-soft)]',
  destructive:
    'border-[color-mix(in_oklab,var(--danger)_34%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--ink-soft)]',
}

export type AlertProps = React.ComponentProps<'div'> & {
  variant?: AlertVariant
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'rounded-xl border p-4 text-sm',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
)
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<'p'>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('m-0 mb-1 font-semibold text-[var(--ink)]', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<'p'>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('m-0 text-sm text-[var(--ink-soft)]', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
