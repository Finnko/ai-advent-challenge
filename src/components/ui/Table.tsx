import * as React from 'react'

import { cn } from '@lib/utils'

const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentProps<'table'>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
    <table
      ref={ref}
      className={cn(
        'w-full caption-bottom border-collapse text-sm text-[var(--ink-soft)]',
        className,
      )}
      {...props}
    />
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<'thead'>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<'tbody'>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('', className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<'tfoot'>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-[var(--line)] bg-[var(--surface-tint)] font-semibold',
      className,
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<'tr'>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-[var(--line)] transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_5%,var(--surface))] last:border-0',
      className,
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<'th'>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'px-4 py-3 text-left align-middle text-xs font-bold uppercase tracking-wide text-[var(--ink)]',
      className,
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<'td'>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 align-middle text-[var(--ink-soft)]', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentProps<'caption'>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-2 text-sm text-[var(--ink-muted)]', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
}
