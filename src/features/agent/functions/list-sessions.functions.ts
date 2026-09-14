import { createServerFn } from '@tanstack/react-start'
import type { SessionSummary } from '../types'
import { listSessions as listSessionsFromStore } from '../server/store.server'
import { asObject, requireToken } from './validation'

export const listSessions = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    const data = asObject(input)
    return { token: requireToken(data.token) }
  })
  .handler(async ({ data }) => {
    const rows = await listSessionsFromStore(data.token)
    return rows.map((row): SessionSummary => ({
      id: row.id,
      title: row.title,
      strategy: row.strategy,
      scenario: row.scenario,
      createdAt: row.createdAt,
      lastMessage: row.lastMessage,
      messageCount: row.messageCount,
    }))
  })
