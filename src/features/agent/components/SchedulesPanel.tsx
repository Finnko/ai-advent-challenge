import { useJobs, useRunJobs } from '../api/use-jobs'
import JobRunRow from './JobRunRow'
import ScheduleCard from './ScheduleCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

export default function SchedulesPanel() {
  const { data, isPending, error } = useJobs()
  const runJobs = useRunJobs()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="island-kicker m-0 text-[10px]">Расписания</p>
          <p className="demo-muted m-0 mt-1 text-xs">
            Фоновый сбор погоды: тик раз в 15 минут подхватывает просроченные
            расписания. При создании города история загружается сразу.
          </p>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => runJobs.mutate()}
          disabled={runJobs.isPending}
        >
          {runJobs.isPending ? 'Выполняю…' : 'Выполнить сейчас'}
        </Button>
      </div>

      {isPending && <p className="demo-muted m-0 text-xs">Загружаю…</p>}
      {error && (
        <Alert variant="destructive">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      )}
      {runJobs.data && (
        <Alert variant={runJobs.data.ok ? undefined : 'destructive'}>
          <pre className="m-0 whitespace-pre-wrap text-xs">
            {runJobs.data.text}
          </pre>
        </Alert>
      )}
      {runJobs.error && (
        <Alert variant="destructive">
          {runJobs.error instanceof Error
            ? runJobs.error.message
            : String(runJobs.error)}
        </Alert>
      )}

      {data && data.schedules.length === 0 && (
        <p className="demo-muted m-0 text-xs">
          Расписаний нет. Попроси агента запланировать погодный отчёт.
        </p>
      )}
      {data && data.schedules.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      )}

      {data && data.runs.length > 0 && (
        <div>
          <p className="island-kicker m-0 mb-1 text-[10px]">
            Последние прогоны
          </p>
          <ul className="m-0 list-none p-0">
            {data.runs.map((run) => (
              <JobRunRow key={run.id} run={run} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
