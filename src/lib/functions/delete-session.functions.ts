import { createServerFn } from '@tanstack/react-start'
import { deleteSession as deleteSessionFromStore } from '../store.server'
import { asObject, requireSessionId } from './validation'

export const deleteSession = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => {
    const data = asObject(input)
    return { sessionId: requireSessionId(data.sessionId) }
  })
  .handler(async ({ data }) => {
    await deleteSessionFromStore(data.sessionId)
    return { ok: true }
  })
