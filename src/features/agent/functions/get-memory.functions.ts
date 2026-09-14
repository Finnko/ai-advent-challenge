import { createServerFn } from '@tanstack/react-start'
import type { MemoryView } from '../types'
import {
  getLongTermMemory,
  getSession,
  getWorkingMemory,
} from '../server/store.server'
import { asObject, requireSessionId, requireToken } from './validation'

export const getMemory = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number; token: string }) => {
    const data = asObject(input)
    return {
      sessionId: requireSessionId(data.sessionId),
      token: requireToken(data.token),
    }
  })
  .handler(async ({ data }) => {
    const session = await getSession(data.sessionId)
    if (!session || !session.memoryEnabled) {
      return { working: [], longTerm: [] } satisfies MemoryView
    }
    const [working, longTerm] = await Promise.all([
      getWorkingMemory(data.sessionId),
      getLongTermMemory(session.token),
    ])
    return { working, longTerm } satisfies MemoryView
  })
