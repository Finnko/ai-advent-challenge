import type { JobScheduleView } from '../domain/jobs/types'
import { formatMoment } from '../domain/jobs/format'
import { Badge } from '@/components/ui/Badge'

export default function ScheduleCard({
  schedule,
}: {
  schedule: JobScheduleView
}) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">#{schedule.id}</Badge>
        <span className="text-sm font-bold text-[var(--ink)]">
          {schedule.cityName}
        </span>
        <Badge variant={schedule.enabled ? 'success' : 'default'}>
          {schedule.enabled ? 'активно' : 'отменено'}
        </Badge>
      </div>
      <p className="demo-muted m-0 mt-2 text-xs">
        каждые {schedule.intervalMinutes} мин · окно {schedule.windowHours} ч
      </p>
      <dl className="m-0 mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="demo-muted m-0">Последний прогон</dt>
          <dd className="m-0 text-[var(--ink-soft)]">
            {formatMoment(schedule.lastRunAt)}
          </dd>
        </div>
        <div>
          <dt className="demo-muted m-0">Следующий</dt>
          <dd className="m-0 text-[var(--ink-soft)]">
            {formatMoment(schedule.nextRunAt)}
          </dd>
        </div>
        <div>
          <dt className="demo-muted m-0">Покрытие с</dt>
          <dd className="m-0 text-[var(--ink-soft)]">
            {formatMoment(schedule.coverageStart)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
