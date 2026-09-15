import * as React from 'react'

import { cn } from '@lib/utils'

export type ButtonVariant = 'default' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'default' | 'sm' | 'xs' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'border-[var(--accent)] bg-[var(--accent)] text-white shadow-sm hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)]',
  secondary:
    'border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]',
  danger:
    'border-[color-mix(in_oklab,var(--danger)_34%,var(--line-strong))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_16%,var(--surface))]',
  ghost:
    'border-transparent bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-tint)] hover:text-[var(--ink-soft)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 gap-2 px-4 text-sm',
  sm: 'h-7 gap-1.5 px-3 text-xs',
  xs: 'h-6 gap-1 px-2 text-[10px]',
  icon: 'h-8 w-8 p-0',
}

export type ButtonProps = React.ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'default', type = 'button', ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold leading-none transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--accent)_30%,transparent)]',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'

export { Button }
