import { createServerFn } from '@tanstack/react-start'
import { executeAgent, resolveCapabilitiesByToken } from '../agent-service.server'
import type { CompressionComparison } from '../api'
import type { CompressionMessage } from '../compression'
import { resolveStrategy } from '../context/registry'
import {
  getSessionSummary,
  loadMessages as loadMessagesFromStore,
} from '../store.server'
import type { StoredMessage } from '../store.server'
import {
  asObject,
  requireSessionId,
  requireToken,
  requireUser,
} from './validation'

const noopSaveSummary = () => {}

function toCompressionMessage(row: StoredMessage): CompressionMessage {
  return { id: row.id, role: row.role, content: row.content }
}

export const compareCompression = createServerFn({ method: 'POST' })
  .validator((input: { token: string; sessionId: number; user: string }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      sessionId: requireSessionId(data.sessionId),
      user: requireUser(data.user),
    }
  })
  .handler(async ({ data }) => {
    const capabilities = await resolveCapabilitiesByToken(data.token)
    const rows = await loadMessagesFromStore(data.sessionId)
    const stored = await getSessionSummary(data.sessionId)
    const compressionRows = rows.map(toCompressionMessage)
    const previousSummary = stored
      ? { text: stored.summary, throughMessageId: stored.throughMessageId }
      : null

    const compressed = await executeAgent({
      capabilities,
      user: data.user,
      strategy: resolveStrategy('summary'),
      rows: compressionRows,
      previousSummary,
      saveSummary: noopSaveSummary,
    })
    const plain = await executeAgent({
      capabilities,
      user: data.user,
      strategy: resolveStrategy('none'),
      rows: compressionRows,
      previousSummary: null,
      saveSummary: noopSaveSummary,
    })

    return {
      compressed: compressed.run,
      plain: plain.run,
      auxUsage: compressed.auxUsage,
    } satisfies CompressionComparison
  })
