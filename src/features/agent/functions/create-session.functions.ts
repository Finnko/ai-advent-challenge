import { createServerFn } from '@tanstack/react-start'
import type { CreateSessionResult } from '../types'
import { createSession as createSessionInStore } from '../server/store.server'
import { asObject, parseSessionConfigInput, requireToken } from './validation'

export const createSession = createServerFn({ method: 'POST' })
  .validator((input: { token: string; config: unknown }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      config: parseSessionConfigInput(data.config),
    }
  })
  .handler(async ({ data }) => {
    const sessionId = await createSessionInStore(
      data.token,
      data.config.scenario ?? 'Новая сессия',
      data.config,
    )
    return { sessionId } satisfies CreateSessionResult
  })
