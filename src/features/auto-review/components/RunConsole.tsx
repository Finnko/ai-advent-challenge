import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Terminal } from 'lucide-react'

import { cn } from '@lib/utils'
import type { ProgressRow } from '../types'

const STATE_COLOR: Record<ProgressRow['state'], string> = {
  pending: 'text-[var(--ink-muted)]',
  active: 'text-[var(--ink)]',
  done: 'text-[var(--positive)]',
  failed: 'text-[var(--danger)]',
  cancelled: 'text-[var(--warn)]',
}

export default function RunConsole({
  progress,
  live,
}: {
  progress: ProgressRow[]
  live: boolean
}) {
  const [open, setOpen] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (node && live && open) {
      node.scrollTop = node.scrollHeight
    }
  }, [progress.length, live, open])

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-e1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-tint)]"
      >
        <Terminal
          className="h-3.5 w-3.5 text-[var(--ink-muted)]"
          strokeWidth={1.75}
        />
        <span className="text-[11px] font-semibold text-[var(--ink-soft)]">
          Лог прогона
        </span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-[var(--ink-muted)]">
          {progress.length}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[var(--ink-muted)] transition-transform',
            !open && '-rotate-90',
          )}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <div
          ref={ref}
          role="log"
          aria-live={live ? 'polite' : 'off'}
          className="max-h-64 overflow-auto border-t border-[var(--line)] px-3 py-2 font-mono text-[11px] leading-relaxed"
        >
          {progress.length === 0 ? (
            <p className="m-0 text-[var(--ink-muted)]">
              Лог появится после запуска.
            </p>
          ) : (
            progress.map((row) => (
              <div key={row.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-[var(--ink-muted)] opacity-70">
                  {row.at.slice(11, 19)}
                </span>
                <span
                  className={cn('min-w-0 break-words', STATE_COLOR[row.state])}
                >
                  {row.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
