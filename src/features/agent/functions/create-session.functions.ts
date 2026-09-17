import { createServerFn } from '@tanstack/react-start'
import type { CreateSessionResult } from '../types'
import { createSession as createSessionInStore } from '../server/store.server'
import {
  asObject,
  optionalBoolean,
  optionalInvariantSetId,
  optionalProfileId,
  optionalScenario,
  optionalWindowSize,
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
      profileId?: number | null
      windowSize?: number
      taskStateEnabled?: boolean
      invariantSetId?: number | null
    }) => {
      const data = asObject(input)
      return {
        token: requireToken(data.token),
        strategy: requireStrategy(data.strategy),
        scenario: optionalScenario(data.scenario),
        memory: optionalBoolean(data.memory),
        profileId: optionalProfileId(data.profileId),
        windowSize: optionalWindowSize(data.windowSize),
        taskStateEnabled: optionalBoolean(data.taskStateEnabled),
        invariantSetId: optionalInvariantSetId(data.invariantSetId),
      }
    },
  )
  .handler(async ({ data }) => {
    const sessionId = await createSessionInStore(
      data.token,
      data.scenario ?? 'Новая сессия',
      {
        strategy: data.strategy,
        scenario: data.scenario,
        memory: data.memory,
        profileId: data.profileId,
        windowSize: data.windowSize,
        taskStateEnabled: data.taskStateEnabled,
        invariantSetId: data.invariantSetId,
      },
    )
    return { sessionId } satisfies CreateSessionResult
  })
