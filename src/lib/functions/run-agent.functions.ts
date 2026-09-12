import { createServerFn } from '@tanstack/react-start'
import { executeAgent, resolveCapabilitiesByToken } from '../agent-service.server'
import type { RunAgentResult } from '../api'
import type { ContextStrategyId } from '../context/types'
import { resolveStrategy } from '../context/registry'
import type { CompressionMessage } from '../compression'
import {
  appendMessage as appendMessageToStore,
  createSession as createSessionFromStore,
  getSessionSummary,
  loadMessages as loadMessagesFromStore,
  upsertSessionSummary,
} from '../store.server'
import type { StoredMessage } from '../store.server'
import {
  asObject,
  requireNullableSessionId,
  requireStrategy,
  requireToken,
  requireUser,
} from './validation'

function toCompressionMessage(row: StoredMessage): CompressionMessage {
  return { id: row.id, role: row.role, content: row.content }
}

function sessionTitleFrom(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 40 ? `${compact.slice(0, 40)}…` : compact
}

export const runAgent = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      token: string
      sessionId: number | null
      user: string
      strategy?: ContextStrategyId
    }) => {
      const data = asObject(input)
      return {
        token: requireToken(data.token),
        sessionId: requireNullableSessionId(data.sessionId),
        user: requireUser(data.user),
        strategy:
          data.strategy === undefined
            ? 'summary'
            : requireStrategy(data.strategy),
      }
    },
  )
  .handler(async ({ data }) => {
    const capabilities = await resolveCapabilitiesByToken(data.token)

    let sessionId = data.sessionId
    if (sessionId === null) {
      sessionId = await createSessionFromStore(
        data.token,
        sessionTitleFrom(data.user),
      )
    }
    const activeSessionId: number = sessionId

    const rows = await loadMessagesFromStore(activeSessionId)
    const stored = await getSessionSummary(activeSessionId)

    const execution = await executeAgent({
      capabilities,
      user: data.user,
      strategy: resolveStrategy(data.strategy),
      rows: rows.map(toCompressionMessage),
      previousSummary: stored
        ? { text: stored.summary, throughMessageId: stored.throughMessageId }
        : null,
      saveSummary: (summary, throughMessageId) =>
        upsertSessionSummary(activeSessionId, summary, throughMessageId),
    })

    await appendMessageToStore(activeSessionId, 'user', data.user)
    await appendMessageToStore(
      activeSessionId,
      'assistant',
      execution.run.answer,
      execution.run,
    )

    return {
      run: execution.run,
      sessionId: activeSessionId,
      auxUsage: execution.auxUsage,
    } satisfies RunAgentResult
  })
