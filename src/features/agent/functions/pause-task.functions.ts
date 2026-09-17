import { createServerFn } from '@tanstack/react-start'
import { applyTaskAction } from '../server/task-state.server'
import type { TaskStateResult } from '../types'
import { asObject, requireSessionId } from './validation'

export const pauseTask = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => {
    const data = asObject(input)
    return { sessionId: requireSessionId(data.sessionId) }
  })
  .handler(async ({ data }) => {
    return {
      taskState: await applyTaskAction(data.sessionId, 'pause'),
    } satisfies TaskStateResult
  })
