import { createServerFn } from '@tanstack/react-start'
import { deleteMemoryEntry } from '../server/store.server'
import {
  asObject,
  requireMemoryLayer,
  requireSessionId,
  requireText,
  requireToken,
} from './validation'

export const deleteMemory = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      scope: string
      sessionId: number
      token: string
      key: string
    }) => {
      const data = asObject(input)
      return {
        scope: requireMemoryLayer(data.scope),
        sessionId: requireSessionId(data.sessionId),
        token: requireToken(data.token),
        key: requireText(data.key, 'Ключ памяти обязателен'),
      }
    },
  )
  .handler(async ({ data }) => {
    await deleteMemoryEntry(
      data.scope === 'working'
        ? { sessionId: data.sessionId }
        : { token: data.token },
      data.scope,
      data.key,
    )
    return { ok: true } as const
  })
