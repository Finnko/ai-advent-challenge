import { createServerFn } from '@tanstack/react-start'
import {
  approveFileTaskRun,
  listFileRunsView,
  startFileTask,
} from '../server/file-service.server'
import { parseApproveFileTaskInput, parseFileTaskInput } from './validation'

export const startFileTaskFn = createServerFn({ method: 'POST' })
  .validator(parseFileTaskInput)
  .handler(async ({ data }) => startFileTask(data))

export const approveFileTaskFn = createServerFn({ method: 'POST' })
  .validator(parseApproveFileTaskInput)
  .handler(async ({ data }) => approveFileTaskRun(data))

export const listFileRunsFn = createServerFn({ method: 'GET' }).handler(
  async () => listFileRunsView(10),
)
