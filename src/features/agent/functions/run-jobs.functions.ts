import { createServerFn } from '@tanstack/react-start'
import { runJobsTick } from '../server/jobs.server'

export const runJobs = createServerFn({ method: 'POST' }).handler(async () =>
  runJobsTick(),
)
