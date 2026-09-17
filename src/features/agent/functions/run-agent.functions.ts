import { createServerFn } from '@tanstack/react-start'
import { executeAgent, resolveCapabilitiesByToken } from '../server/agent-service.server'
import type { RunAgentResult } from '../types'
import type { ContextStrategyId } from '../domain/context/types'
import { resolveStrategy } from '../domain/context/registry'
import type { CompressionMessage } from '../domain/compression'
import {
  appendMessage as appendMessageToStore,
  createSession as createSessionFromStore,
  getActiveBranch,
  getLongTermMemory,
  getProfile,
  getSession,
  getSessionFacts,
  getSessionSummary,
  getWorkingMemory,
  loadMessages as loadMessagesFromStore,
  saveLongTermMemory,
  saveSessionFacts,
  saveWorkingMemory,
  upsertSessionSummary,
} from '../server/store.server'
import type { StoredMessage } from '../server/store.server'
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
            ? undefined
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
        { strategy: data.strategy ?? 'summary' },
      )
    }
    const activeSessionId: number = sessionId

    const session = await getSession(activeSessionId)
    const strategyId: ContextStrategyId = session?.strategy ?? 'summary'
    const activeBranch = await getActiveBranch(activeSessionId)
    const rows = await loadMessagesFromStore(activeSessionId)
    const stored = await getSessionSummary(activeSessionId)
    const facts = await getSessionFacts(activeSessionId)

    const memoryEnabled = session?.memoryEnabled ?? false
    const working = memoryEnabled
      ? await getWorkingMemory(activeSessionId)
      : []
    const longTerm = memoryEnabled
      ? await getLongTermMemory(session?.token ?? data.token)
      : []

    const profile =
      session?.profileId != null ? await getProfile(session.profileId) : null

    const execution = await executeAgent({
      capabilities,
      user: data.user,
      strategy: resolveStrategy(strategyId),
      rows: rows.map(toCompressionMessage),
      previousSummary: stored
        ? { text: stored.summary, throughMessageId: stored.throughMessageId }
        : null,
      facts,
      branchLabel: activeBranch?.title,
      profile,
      memory: {
        enabled: memoryEnabled,
        token: session?.token ?? data.token,
        sessionId: activeSessionId,
        scenario: session?.scenario ?? null,
        working,
        longTerm,
        saveWorking: (entries) => saveWorkingMemory(activeSessionId, entries),
        saveLongTerm: (entries) =>
          saveLongTermMemory(session?.token ?? data.token, entries),
      },
      saveSummary: (summary, throughMessageId) =>
        upsertSessionSummary(activeSessionId, summary, throughMessageId),
      saveFacts: (next) => saveSessionFacts(activeSessionId, next),
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
