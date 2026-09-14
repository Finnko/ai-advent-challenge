import { createServerFn } from '@tanstack/react-start'
import type { ScenarioComparison } from '../types'
import {
  getSessionFacts,
  listSessionsByScenario,
  loadMessages as loadMessagesFromStore,
} from '../server/store.server'
import { asObject, requireText, requireToken } from './validation'

export const compareSessions = createServerFn({ method: 'POST' })
  .validator((input: { token: string; scenario: string }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      scenario: requireText(data.scenario, 'Сценарий обязателен'),
    }
  })
  .handler(async ({ data }) => {
    const sessions = await listSessionsByScenario(data.token, data.scenario)
    const traces = await Promise.all(
      sessions.map(async (session) => {
        const [messages, facts] = await Promise.all([
          loadMessagesFromStore(session.id),
          getSessionFacts(session.id),
        ])
        return {
          sessionId: session.id,
          title: session.title,
          strategy: session.strategy,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
            run: message.run,
          })),
          facts,
        }
      }),
    )
    return { scenario: data.scenario, traces } satisfies ScenarioComparison
  })
