import { createServerFn } from '@tanstack/react-start'
import { loadMessages as loadMessagesFromStore } from '../store.server'
import { asObject, requireSessionId } from './validation'

export const loadSession = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => {
    const data = asObject(input)
    return { sessionId: requireSessionId(data.sessionId) }
  })
  .handler(async ({ data }) => loadMessagesFromStore(data.sessionId))
