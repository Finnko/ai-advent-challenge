import { createServerFn } from '@tanstack/react-start'
import type { CreateSessionResult } from '../types'
import { createSession as createSessionInStore } from '../server/store.server'
import {
  asObject,
  optionalScenario,
  requireStrategy,
  requireToken,
} from './validation'

export const createSession = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      token: string
      strategy: string
      scenario?: string | null
      memory?: boolean
    }) => {
      const data = asObject(input)
      return {
        token: requireToken(data.token),
        strategy: requireStrategy(data.strategy),
        scenario: optionalScenario(data.scenario),
        memory: data.memory === true,
      }
    },
  )
  .handler(async ({ data }) => {
    const sessionId = await createSessionInStore(
      data.token,
      data.scenario ?? 'Новая сессия',
      { strategy: data.strategy, scenario: data.scenario, memory: data.memory },
    )
    return { sessionId } satisfies CreateSessionResult
  })
