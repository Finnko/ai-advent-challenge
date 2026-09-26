import { createServerFn } from '@tanstack/react-start'
import { listJobsOverview } from '../server/jobs.server'

export const listJobs = createServerFn({ method: 'GET' }).handler(async () =>
  listJobsOverview(),
)
