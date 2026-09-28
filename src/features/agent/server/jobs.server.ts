import type { JobsOverview } from '../domain/jobs/types'
import { runView, scheduleView } from '../domain/jobs/view'
import { getJobsDb } from '../mcp/jobs/db'
import { callToolOnServer } from './mcp.server'

export type { JobsOverview, JobRunView, JobScheduleView } from '../domain/jobs/types'

export async function listJobsOverview(): Promise<JobsOverview> {
  const store = await getJobsDb()
  const schedules = store.listSchedules()
  const byId = new Map(schedules.map((schedule) => [schedule.id, schedule]))
  const runs = store.listRecentRuns(10)
  return {
    schedules: schedules.map((schedule) => scheduleView(store, schedule)),
    runs: runs.map((run) =>
      runView(run, byId.get(run.scheduleId)?.city ?? ''),
    ),
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
