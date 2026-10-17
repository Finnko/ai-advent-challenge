import { Ban, Check, X } from 'lucide-react'

import { cn } from '@lib/utils'
import { STAGE_LABELS, STAGE_ORDER } from '../types'
import type { ProgressRow, StageId, StageState } from '../types'

const CIRCLE: Record<StageState, string> = {
  pending: 'border-[var(--line-strong)] text-[var(--ink-muted)]',
  active: 'border-[var(--accent)] text-[var(--accent)]',
  done: 'border-[var(--positive)] text-[var(--positive)]',
  failed: 'border-[var(--danger)] text-[var(--danger)]',
  cancelled: 'border-[var(--warn)] text-[var(--warn)]',
}

const LABEL: Record<StageState, string> = {
  pending: 'text-[var(--ink-muted)]',
  active: 'text-[var(--ink)]',
  done: 'text-[var(--ink-soft)]',
  failed: 'text-[var(--danger)]',
  cancelled: 'text-[var(--warn)]',
}

const STATE_TEXT: Record<StageState, string> = {
  pending: '',
  active: 'идёт',
  done: '',
  failed: 'ошибка',
  cancelled: 'отменено',
}

function stageStates(progress: ProgressRow[]): Record<StageId, StageState> {
  const states = {} as Record<StageId, StageState>
  for (const stage of STAGE_ORDER) {
    states[stage] = 'pending'
  }
  for (const row of progress) {
    if (row.state === 'active') {
      if (states[row.stage] !== 'done' && states[row.stage] !== 'failed') {
        states[row.stage] = 'active'
      }
      continue
    }
    states[row.stage] = row.state
  }
  return states
}

function stageMark(state: StageState) {
  if (state === 'done') {
    return <Check className="h-2.5 w-2.5" strokeWidth={3} />
  }
  if (state === 'failed') {
    return <X className="h-2.5 w-2.5" strokeWidth={3} />
  }
  if (state === 'cancelled') {
    return <Ban className="h-2.5 w-2.5" strokeWidth={2.5} />
  }
  if (state === 'active') {
    return (
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
    )
  }
  return <span className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
}

export default function ReviewTimeline({
  progress,
}: {
  progress: ProgressRow[]
}) {
  const states = stageStates(progress)
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {STAGE_ORDER.map((stage, index) => {
        const state = states[stage]
        return (
          <li
            key={stage}
            className="flex gap-2.5"
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                  CIRCLE[state],
                )}
              >
                {stageMark(state)}
              </span>
              {index < STAGE_ORDER.length - 1 && (
                <span
                  className={cn(
                    'my-0.5 w-px flex-1',
                    state === 'done'
                      ? 'bg-[color-mix(in_oklab,var(--positive)_35%,var(--line))]'
                      : 'bg-[var(--line)]',
                  )}
                />
              )}
            </div>
            <div className="flex min-w-0 items-baseline gap-2 pb-2.5">
              <p
                className={cn(
                  'm-0 text-xs font-semibold leading-tight',
                  LABEL[state],
                )}
              >
                {STAGE_LABELS[stage]}
              </p>
              {STATE_TEXT[state].length > 0 && (
                <span className="text-[10px] text-[var(--ink-muted)]">
                  {STATE_TEXT[state]}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
