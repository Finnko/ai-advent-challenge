import type { TaskEvent } from '../domain/task/types'
import { TASK_STAGE_LABELS } from '../domain/task/types'
import { Badge } from '@/components/ui/Badge'

export default function TaskEventRow({ event }: { event: TaskEvent }) {
  if (event.kind === 'created') {
    return (
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="h-px w-8 bg-[var(--line)]" />
        <Badge variant="accent" title="Агент завёл задачу">
          задача · {TASK_STAGE_LABELS[event.stage]}
        </Badge>
        <span className="max-w-[60%] truncate text-xs font-semibold text-[var(--ink-soft)]">
          {event.title}
        </span>
        <span className="h-px w-8 bg-[var(--line)]" />
      </div>
    )
  }
  if (event.kind === 'step') {
    return (
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="h-px w-8 bg-[var(--line)]" />
        <Badge variant="accent">шаг {event.index + 1}</Badge>
        <span className="max-w-[60%] truncate text-xs text-[var(--ink-muted)]">
          {event.to}
        </span>
        <span className="h-px w-8 bg-[var(--line)]" />
      </div>
    )
  }
  const paused = event.to === 'paused'
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <span className="h-px w-8 bg-[var(--line)]" />
      <Badge variant={paused ? 'warn' : 'default'}>
        {event.from} → {event.to}
      </Badge>
      <span className="max-w-[60%] truncate text-xs text-[var(--ink-muted)]">
        {TASK_STAGE_LABELS[event.to]}
        {event.reason ? ` · ${event.reason}` : ''}
      </span>
      <span className="h-px w-8 bg-[var(--line)]" />
    </div>
  )
}
