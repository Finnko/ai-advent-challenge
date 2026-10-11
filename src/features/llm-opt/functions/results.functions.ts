import { createServerFn } from '@tanstack/react-start'
import { loadRuns, resetRuns } from '../server/results.server'

export const getRunsFn = createServerFn({ method: 'GET' }).handler(async () =>
  loadRuns(),
)

export const resetRunsFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    resetRuns()
    return []
  },
)
