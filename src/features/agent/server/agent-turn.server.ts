import type { AgentCapabilities, AgentTool, SystemBlock } from '../domain/agent'
import type {
  AgentCapability,
  RetrievedSource,
} from '../domain/capabilities/types'
import {
  AGENT_RAG_CAPABILITY_ID,
  getAgentCapabilities,
} from './capability-registry.server'
import type { CompressionMessage } from '../domain/compression'
import { resolveStrategy } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'
import type { Fact } from '../domain/facts'
import type { MemoryEntry } from '../domain/memory/types'
import type { ProfileRecord } from '../domain/profile/types'
import type { InvariantRecord } from '../domain/invariants/types'
import { resolveSessionConfig } from '../domain/session/config'
import type { TaskEvent, TaskState } from '../domain/task/types'
import type { AgentExecution, AgentRuntime } from './agent-service.server'
import {
  defaultAgentRuntime,
  executeAgent,
  resolveCapabilitiesByToken,
} from './agent-service.server'
import { getActiveBranch } from './store/branches.server'
import {
  getSessionFacts,
  getSessionSummary,
  saveSessionFacts,
  upsertSessionSummary,
} from './store/facts.server'
import { listInvariants } from './store/invariants.server'
import {
  getLongTermMemory,
  getWorkingMemory,
  saveLongTermMemory,
  saveWorkingMemory,
} from './store/memory.server'
import {
  appendMessage as appendMessageToStore,
  loadMessages as loadMessagesFromStore,
} from './store/messages.server'
import { getProfile } from './store/profiles.server'
import {
  getSession,
  updateSessionTitleIfDefault,
} from './store/sessions.server'
import { getTaskState, saveTaskState } from './store/tasks.server'
import {
  beginTaskTurn,
  completeTaskTurn,
  mergeUsage,
  rejectionNote,
  resolveCorrection,
  resolveTaskState,
  silentRun,
} from './task-turn.server'

export type TurnSession = {
  token: string
  strategy: ContextStrategyId
  scenario: string | null
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null
  taskStateEnabled: boolean
  ragEnabled: boolean
  invariantSetId: number | null
}

export type TurnStore = {
  getSession(sessionId: number): Promise<TurnSession | null>
  getActiveBranchTitle(sessionId: number): Promise<string | undefined>
  loadMessages(sessionId: number): Promise<
    Array<{
      id: number
      role: 'user' | 'assistant' | 'task'
      content: string
      taskEvent?: TaskEvent | null
    }>
  >
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
  getTaskState(sessionId: number): Promise<TaskState | null>
  getInvariants?: (token: string) => Promise<InvariantRecord[]>
  saveTaskState(sessionId: number, state: TaskState): Promise<void>
  updateSessionTitleIfDefault(sessionId: number, title: string): Promise<void>
  appendMessage(
    sessionId: number,
    role: 'user' | 'assistant' | 'task',
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
  capabilities?(): AgentCapability[]
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
  getTaskState,
  getInvariants: listInvariants,
  saveTaskState,
  updateSessionTitleIfDefault,
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

function resolveRagCapability(
  deps: TurnDeps,
  config: { ragEnabled: boolean },
): AgentCapability | null {
  if (!config.ragEnabled) {
    return null
  }
  const available = (deps.capabilities ?? getAgentCapabilities)()
  return (
    available.find((capability) => capability.id === AGENT_RAG_CAPABILITY_ID) ??
    null
  )
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
  const history = rows.filter(
    (row): row is typeof row & { role: 'user' | 'assistant' } =>
      row.role !== 'task',
  )
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

  const now = deps.now()
  const at = now.toISOString()

  const begin = await beginTaskTurn(
    {
      enabled: config.taskStateEnabled,
      sessionId,
      user: input.user,
      at,
    },
    deps.store,
  )
  if ('halt' in begin) {
    return begin.halt
  }
  const preEvents = begin.preEvents

  const taskOutcome = await resolveTaskState(
    {
      enabled: config.taskStateEnabled,
      sessionId,
      rows: history.map((row) => ({ role: row.role, content: row.content })),
      user: input.user,
      at,
    },
    deps.store,
    deps.runtime.analyzeTaskState,
  )

  let activeTaskState = taskOutcome.taskState
  const taskNote = rejectionNote(taskOutcome.rejection, activeTaskState)
  let correctionEvent: TaskEvent | null = null
  if (activeTaskState) {
    const correction = resolveCorrection(activeTaskState, input.user, at)
    if (correction) {
      activeTaskState = correction.state
      correctionEvent = correction.event
    }
  }

  const sessionTitle = (taskOutcome.taskState?.title ?? input.user).trim()
  await deps.store.updateSessionTitleIfDefault(sessionId, sessionTitle)

  const ragCapability = resolveRagCapability(deps, config)
  const extraBlocks: SystemBlock[] = []
  const extraTools: AgentTool[] = []
  let ragSources: RetrievedSource[] = []
  if (ragCapability) {
    const contribution = await ragCapability.prepare({
      query: input.user,
      token,
    })
    if (contribution.block) {
      extraBlocks.push(contribution.block)
    }
    extraTools.push(...contribution.tools)
    ragSources = contribution.sources
  }

  const execution = await executeAgent(
    {
      capabilities,
      user: input.user,
      strategy,
      rows: history.map(toCompressionMessage),
      branchLabel: branchTitle,
      windowSize: config.windowSize,
      profile,
      taskState: activeTaskState,
      taskStateEnabled: config.taskStateEnabled,
      taskNote,
      isPaused: async () =>
        (await deps.store.getTaskState(sessionId))?.stage === 'paused',
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
      now,
      invariants: deps.store.getInvariants
        ? await deps.store.getInvariants(token)
        : [],
      extraBlocks,
      extraTools,
    },
    deps.runtime,
  )

  const completion = await completeTaskTurn(
    {
      sessionId,
      activeState: activeTaskState,
      run: execution.run,
      user: input.user,
      now,
      at,
      stateChanged: taskOutcome.changed || correctionEvent !== null,
      preEvents,
      taskEvent: taskOutcome.taskEvent,
      rejection: taskOutcome.rejection,
      correctionEvent,
    },
    deps.store,
  )

  const finalTaskState = completion.state
  const ragOutcome = ragCapability
    ? ragCapability.classify(execution.run.answer, ragSources)
    : null
  const run = {
    ...execution.run,
    taskState: finalTaskState,
    ...(ragCapability
      ? {
          sources: ragSources,
          grounding: ragOutcome?.grounding,
          citations: ragOutcome?.citations ?? [],
        }
      : {}),
  }

  await deps.store.appendMessage(sessionId, 'user', input.user)
  for (const event of completion.events) {
    await deps.store.appendMessage(sessionId, 'task', '', event)
  }
  if (completion.concurrentPause) {
    return {
      run: silentRun(finalTaskState),
      auxUsage: mergeUsage(execution.auxUsage, taskOutcome.usage),
      taskState: finalTaskState,
    }
  }
  await deps.store.appendMessage(sessionId, 'assistant', run.answer, run)

  return {
    run,
    auxUsage: mergeUsage(execution.auxUsage, taskOutcome.usage),
    taskState: finalTaskState,
  }
}
