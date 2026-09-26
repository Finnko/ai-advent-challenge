import type { AgentCapabilities, AgentRunResult } from '../domain/agent'
import type { CompressionMessage, SummaryUsage } from '../domain/compression'
import { resolveStrategy } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'
import type { Fact } from '../domain/facts'
import type { MemoryEntry } from '../domain/memory/types'
import type { ProfileRecord } from '../domain/profile/types'
import type { InvariantRecord } from '../domain/invariants/types'
import {
  resolveSessionConfig,
} from '../domain/session/config'
import {
  advanceAfterRun,
  advanceToExecution,
  looksLikeApproval,
  looksLikeCancel,
  looksLikeCorrection,
  looksLikeResume,
} from '../domain/task/advance'
import {
  applyAnalysis,
  cancelTask,
  createTaskState,
  resumeTask,
  transitionEvent,
} from '../domain/task/state'
import type { AnalyzeTaskState } from '../domain/task/analyze'
import type { TaskAnalysis, TaskRejection } from '../domain/task/state'
import type { TaskEvent, TaskState } from '../domain/task/types'
import { TIER_ENDPOINTS } from '@lib/llm'
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
  getTaskState,
  getWorkingMemory,
  listInvariants,
  loadMessages as loadMessagesFromStore,
  saveLongTermMemory,
  saveSessionFacts,
  saveTaskState,
  saveWorkingMemory,
  updateSessionTitleIfDefault,
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
  ): Promise<
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

function mergeUsage(
  left: SummaryUsage | null,
  right: SummaryUsage | null,
): SummaryUsage | null {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return {
    prompt_tokens: left.prompt_tokens + right.prompt_tokens,
    completion_tokens: left.completion_tokens + right.completion_tokens,
  }
}

type TaskOutcome = {
  taskState: TaskState | null
  taskEvent: TaskEvent | null
  changed: boolean
  usage: SummaryUsage | null
  rejection: TaskRejection | null
}

const ZERO_TOKENS: AgentRunResult['tokens'] = {
  requestTokens: 0,
  historyTokens: 0,
  historyTokensSent: 0,
  contextTokens: 0,
  contextMessages: 0,
  responseTokens: 0,
  promptTokensActual: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  costUsd: 0,
}

function silentRun(taskState: TaskState | null): AgentRunResult {
  return {
    ok: true,
    blocked: false,
    reason: null,
    answer: '',
    trace: [],
    verdicts: [],
    usage: null,
    latencyMs: 0,
    model: TIER_ENDPOINTS.medium.model,
    tokens: { ...ZERO_TOKENS },
    contextNote: null,
    invariantHits: [],
    taskState,
  }
}

function eventFromHistory(
  next: TaskState,
  prev: TaskState,
): TaskEvent | null {
  const transition =
    next.history.length > prev.history.length
      ? next.history.at(-1)
      : undefined
  return transition ? transitionEvent(transition) : null
}

function rejectionNote(
  rejection: TaskRejection | null,
  state: TaskState | null,
): string | null {
  if (!rejection) {
    return null
  }
  const stay = state?.stage ?? rejection.from
  return `Попытка перейти ${rejection.from} → ${rejection.to} отклонена: ${rejection.reason} Оставайся на этапе ${stay} и продолжай по плану.`
}

async function resolveTaskState(
  input: {
    enabled: boolean
    sessionId: number
    rows: Array<{ role: 'user' | 'assistant'; content: string }>
    user: string
    at: string
  },
  store: TurnStore,
  analyze: AnalyzeTaskState,
): Promise<TaskOutcome> {
  if (!input.enabled) {
    return {
      taskState: null,
      taskEvent: null,
      changed: false,
      usage: null,
      rejection: null,
    }
  }
  const current = await store.getTaskState(input.sessionId)
  let analysis: TaskAnalysis | null = null
  let usage: SummaryUsage | null = null
  try {
    const result = await analyze({
      current,
      history: input.rows,
      userMessage: input.user,
    })
    analysis = result.analysis
    usage = result.usage
  } catch {
    usage = null
  }

  if (analysis?.stage === 'cancelled') {
    analysis = { ...analysis, stage: current?.stage ?? 'planning' }
  }

  if (!analysis) {
    return {
      taskState: current,
      taskEvent: null,
      changed: false,
      usage,
      rejection: null,
    }
  }

  if (!current) {
    const created = createTaskState(analysis, input.at)
    return {
      taskState: created,
      taskEvent: {
        kind: 'created',
        title: created.title,
        stage: created.stage,
        at: input.at,
      },
      changed: true,
      usage,
      rejection: null,
    }
  }

  let rejection: TaskRejection | null = null
  const planIncomplete = analysis.expectedAction.actor === 'user'
  if (
    current.stage === 'planning' &&
    analysis.stage === 'execution' &&
    planIncomplete
  ) {
    rejection = {
      from: 'planning',
      to: 'execution',
      reason: 'В плане остались незакрытые пункты — сначала утвердите все пункты.',
    }
    analysis = { ...analysis, stage: 'planning' }
  }

  const consent =
    current.stage === 'planning' &&
    analysis.stage === 'execution' &&
    !planIncomplete &&
    looksLikeApproval(input.user)

  const applied = applyAnalysis(current, analysis, input.at)
  let next = applied.state
  if (consent && !next.approved) {
    next = { ...next, approved: true, updatedAt: input.at }
  }
  return {
    taskState: next,
    taskEvent: next === current ? null : eventFromHistory(next, current),
    changed: next !== current,
    usage,
    rejection: rejection ?? applied.rejection,
  }
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
  const started = config.taskStateEnabled
    ? await deps.store.getTaskState(sessionId)
    : null
  const preEvents: TaskEvent[] = []

  if (config.taskStateEnabled && looksLikeCancel(input.user)) {
    if (started && started.stage !== 'cancelled') {
      const cancelled = cancelTask(started, at)
      if (cancelled !== started) {
        await deps.store.saveTaskState(sessionId, cancelled)
        await deps.store.appendMessage(sessionId, 'user', input.user)
        const event = eventFromHistory(cancelled, started)
        if (event) {
          await deps.store.appendMessage(sessionId, 'task', '', event)
        }
        return {
          run: silentRun(cancelled),
          auxUsage: null,
          taskState: cancelled,
        }
      }
    }
  }

  if (started?.stage === 'paused') {
    if (looksLikeResume(input.user)) {
      const resumed = resumeTask(started, at)
      if (resumed !== started) {
        await deps.store.saveTaskState(sessionId, resumed)
        const event = eventFromHistory(resumed, started)
        if (event) {
          preEvents.push(event)
        }
      }
    } else {
      await deps.store.appendMessage(sessionId, 'user', input.user)
      return {
        run: silentRun(started),
        auxUsage: null,
        taskState: started,
      }
    }
  }

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
  let changed = taskOutcome.changed
  const rejection = taskOutcome.rejection
  const taskNote = rejectionNote(rejection, activeTaskState)
  let correctionEvent: TaskEvent | null = null
  if (
    activeTaskState &&
    activeTaskState.stage === 'validation' &&
    looksLikeCorrection(input.user)
  ) {
    const correction = advanceToExecution(activeTaskState, now.toISOString())
    if (correction) {
      activeTaskState = correction.state
      changed = true
      correctionEvent = correction.event
    }
  }

  const sessionTitle = (taskOutcome.taskState?.title ?? input.user).trim()
  await deps.store.updateSessionTitleIfDefault(sessionId, sessionTitle)

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
    },
    deps.runtime,
  )

  const persisted = await deps.store.getTaskState(sessionId)
  const concurrentPause =
    persisted?.stage === 'paused' && activeTaskState?.stage !== 'paused'
  const events: TaskEvent[] = [...preEvents]
  if (rejection) {
    events.push({
      kind: 'rejected',
      from: rejection.from,
      to: rejection.to,
      reason: rejection.reason,
      at,
    })
  }
  let finalTaskState: TaskState | null = activeTaskState
  if (concurrentPause) {
    finalTaskState = persisted
  } else {
    const advance = advanceAfterRun(
      activeTaskState,
      execution.run,
      now.toISOString(),
      input.user,
    )
    if (advance) {
      finalTaskState = advance.state
      changed = true
    }
    if (taskOutcome.taskEvent) {
      events.push(taskOutcome.taskEvent)
    }
    if (correctionEvent) {
      events.push(correctionEvent)
    }
    if (advance) {
      events.push(advance.event)
    }
    if (changed && finalTaskState) {
      await deps.store.saveTaskState(sessionId, finalTaskState)
    }
  }

  const run = { ...execution.run, taskState: finalTaskState }

  await deps.store.appendMessage(sessionId, 'user', input.user)
  for (const event of events) {
    await deps.store.appendMessage(sessionId, 'task', '', event)
  }
  if (concurrentPause) {
    return {
      run: silentRun(finalTaskState),
      auxUsage: mergeUsage(execution.auxUsage, taskOutcome.usage),
      taskState: finalTaskState,
    }
  }
  await deps.store.appendMessage(
    sessionId,
    'assistant',
    run.answer,
    run,
  )

  return {
    run,
    auxUsage: mergeUsage(execution.auxUsage, taskOutcome.usage),
    taskState: finalTaskState,
  }
}
