import { createServerFn } from '@tanstack/react-start'
import { getSessionFacts } from '../server/store.server'
import { asObject, requireSessionId } from './validation'

export const getFacts = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => ({
    sessionId: requireSessionId(asObject(input).sessionId),
  }))
  .handler(async ({ data }) => getSessionFacts(data.sessionId))
