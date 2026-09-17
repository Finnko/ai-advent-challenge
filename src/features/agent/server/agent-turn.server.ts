import type { AgentCapabilities } from '../domain/agent'
import type { CompressionMessage } from '../domain/compression'
import { resolveStrategy } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'
import type { Fact } from '../domain/facts'
import type { MemoryEntry } from '../domain/memory/types'
import type { ProfileRecord } from '../domain/profile/types'
import {
  resolveSessionConfig,
} from '../domain/session/config'
import type { AgentExecution, AgentRuntime } from './agent-service.server'
import {
  defaultAgentRuntime,
  executeAgent,
  resolveCapabilitiesByToken,
} from './agent-service.server'
import {
  appendMessage as appendMessageToStore,
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
} from './store.server'

export type TurnSession = {
  token: string
  strategy: ContextStrategyId
  scenario: string | null
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null
  taskStateEnabled: boolean
  invariantSetId: number | null
}

export type TurnStore = {
  getSession(sessionId: number): Promise<TurnSession | null>
  getActiveBranchTitle(sessionId: number): Promise<string | undefined>
  loadMessages(
    sessionId: number,
  ): Promise<Array<{ id: number; role: 'user' | 'assistant'; content: string }>>
  getSummary(
    sessionId: number,
  ): Promise<{ summary: string; throughMessageId: number } | null>
  saveSummary(
    sessionId: number,
    summary: string,
    throughMessageId: number,
  ): Promise<void>
  getFacts(sessionId: number): Promise<Fact[]>
  saveFacts(sessionId: number, facts: Fact[]): Promise<void>
  getWorkingMemory(sessionId: number): Promise<MemoryEntry[]>
  getLongTermMemory(token: string): Promise<MemoryEntry[]>
  saveWorkingMemory(sessionId: number, entries: MemoryEntry[]): Promise<void>
  saveLongTermMemory(token: string, entries: MemoryEntry[]): Promise<void>
  getProfile(profileId: number): Promise<ProfileRecord | null>
  appendMessage(
    sessionId: number,
    role: 'user' | 'assistant',
    content: string,
    run?: unknown,
  ): Promise<void>
}

export type AgentTurnInput = {
  token: string
  sessionId: number
  user: string
}

export type TurnDeps = {
  resolveCapabilities(token: string): Promise<AgentCapabilities>
  store: TurnStore
  runtime: AgentRuntime
  now(): Date
}

const defaultTurnStore: TurnStore = {
  getSession,
  getActiveBranchTitle: async (sessionId) =>
    (await getActiveBranch(sessionId))?.title,
  loadMessages: loadMessagesFromStore,
  getSummary: getSessionSummary,
  saveSummary: upsertSessionSummary,
  getFacts: getSessionFacts,
  saveFacts: saveSessionFacts,
  getWorkingMemory,
  getLongTermMemory,
  saveWorkingMemory,
  saveLongTermMemory,
  getProfile,
  appendMessage: appendMessageToStore,
}

export const defaultTurnDeps: TurnDeps = {
  resolveCapabilities: resolveCapabilitiesByToken,
  store: defaultTurnStore,
  runtime: defaultAgentRuntime,
  now: () => new Date(),
}

function toCompressionMessage(row: {
  id: number
  role: 'user' | 'assistant'
  content: string
}): CompressionMessage {
  return { id: row.id, role: row.role, content: row.content }
}

export async function runAgentTurn(
  input: AgentTurnInput,
  deps: TurnDeps = defaultTurnDeps,
): Promise<AgentExecution> {
  const sessionId = input.sessionId
  const session = await deps.store.getSession(sessionId)
  if (!session || session.token !== input.token) {
    throw new Error('Сессия не найдена')
  }
  const capabilities = await deps.resolveCapabilities(input.token)
  const token = session.token
  const config = resolveSessionConfig(session, null)

  const branchTitle = await deps.store.getActiveBranchTitle(sessionId)
  const rows = await deps.store.loadMessages(sessionId)
  const stored = await deps.store.getSummary(sessionId)
  const facts = await deps.store.getFacts(sessionId)

  const working = config.memoryEnabled
    ? await deps.store.getWorkingMemory(sessionId)
    : []
  const longTerm = config.memoryEnabled
    ? await deps.store.getLongTermMemory(token)
    : []
  const profile =
    config.profileId !== null
      ? await deps.store.getProfile(config.profileId)
      : null

  const strategy = resolveStrategy(config.strategy, {
    summary: {
      previousSummary: stored
        ? { text: stored.summary, throughMessageId: stored.throughMessageId }
        : null,
      summarize: deps.runtime.summarize,
      saveSummary: (summary, throughMessageId) =>
        deps.store.saveSummary(sessionId, summary, throughMessageId),
    },
    facts: {
      facts,
      extractFacts: deps.runtime.extractFacts,
      saveFacts: (next) => deps.store.saveFacts(sessionId, next),
    },
  })

  const execution = await executeAgent(
    {
      capabilities,
      user: input.user,
      strategy,
      rows: rows.map(toCompressionMessage),
      branchLabel: branchTitle,
      windowSize: config.windowSize,
      profile,
      memory: {
        enabled: config.memoryEnabled,
        token,
        sessionId,
        scenario: config.scenario,
        working,
        longTerm,
        saveWorking: (entries) =>
          deps.store.saveWorkingMemory(sessionId, entries),
        saveLongTerm: (entries) =>
          deps.store.saveLongTermMemory(token, entries),
      },
      now: deps.now(),
    },
    deps.runtime,
  )

  await deps.store.appendMessage(sessionId, 'user', input.user)
  await deps.store.appendMessage(
    sessionId,
    'assistant',
    execution.run.answer,
    execution.run,
  )

  return execution
}
