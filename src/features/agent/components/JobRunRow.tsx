import type { JobRunView } from '../domain/jobs/types'
import { formatMoment, sampleText } from '../domain/jobs/format'
import { Badge } from '@/components/ui/Badge'

export default function JobRunRow({ run }: { run: JobRunView }) {
  const detail = run.status === 'ok' ? sampleText(run.value) : (run.error ?? '—')
  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-1.5 last:border-b-0">
      <span className="demo-muted text-xs">
        {formatMoment(run.observedAt ?? run.ranAt)}
      </span>
      <Badge variant={run.status === 'ok' ? 'success' : 'danger'}>
        {run.status === 'ok' ? 'ок' : 'ошибка'}
      </Badge>
      <Badge variant="outline">
        {run.source === 'bootstrap' ? 'история' : 'live'}
      </Badge>
      <span className="text-xs text-[var(--ink-soft)]">{run.cityName}</span>
      <span className="demo-muted text-xs">{detail}</span>
    </li>
  )
}
