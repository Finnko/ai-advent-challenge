import { createServerFn } from '@tanstack/react-start'
import { readSessionTaskState } from '../server/task-state.server'
import type { TaskStateResult } from '../types'
import { asObject, requireSessionId } from './validation'

export const getTaskState = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => {
    const data = asObject(input)
    return { sessionId: requireSessionId(data.sessionId) }
  })
  .handler(async ({ data }) => {
    return {
      taskState: await readSessionTaskState(data.sessionId),
    } satisfies TaskStateResult
  })
