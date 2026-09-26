import { findCityById } from '../domain/jobs/cities'
import { coverageKey } from '../domain/jobs/coverage'
import type {
  JobsOverview,
  JobScheduleView,
  Schedule,
} from '../domain/jobs/types'
import { getJobsDb } from '../mcp/jobs/db'
import { callToolOnServer } from './mcp.server'

export type { JobsOverview, JobRunView, JobScheduleView } from '../domain/jobs/types'

function cityName(id: string): string {
  return findCityById(id)?.name ?? id
}

function toScheduleView(
  store: Awaited<ReturnType<typeof getJobsDb>>,
  schedule: Schedule,
): JobScheduleView {
  return {
    id: schedule.id,
    city: schedule.city,
    cityName: cityName(schedule.city),
    intervalMinutes: schedule.intervalMinutes,
    windowHours: schedule.windowHours,
    enabled: schedule.enabled,
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt,
    coverageStart: store.getMeta(coverageKey(schedule.city)),
  }
}

export async function listJobsOverview(): Promise<JobsOverview> {
  const store = await getJobsDb()
  const schedules = store.listSchedules()
  const byId = new Map(schedules.map((schedule) => [schedule.id, schedule]))
  const runs = store.listRecentRuns(10)
  return {
    schedules: schedules.map((schedule) => toScheduleView(store, schedule)),
    runs: runs.map((run) => {
      const city = byId.get(run.scheduleId)?.city ?? ''
      return {
        id: run.id,
        scheduleId: run.scheduleId,
        city,
        cityName: cityName(city),
        ranAt: run.ranAt,
        observedAt: run.observedAt,
        status: run.status,
        source: run.source,
        value: run.value,
        error: run.error,
      }
    }),
  }
}

export type JobsTickResult = { ok: boolean; text: string }

export async function runJobsTick(): Promise<JobsTickResult> {
  const result = await callToolOnServer('jobs', 'run_due_jobs', {})
  if (result.ok) {
    return { ok: true, text: result.text }
  }
  return { ok: false, text: result.error }
}
