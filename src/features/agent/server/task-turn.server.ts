import type { AgentRunResult } from '../domain/agent'
import type { SummaryUsage } from '../domain/compression'
import { TIER_ENDPOINTS } from '@lib/llm'
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
import type { AgentExecution } from './agent-service.server'

export type TaskTurnStore = {
  getTaskState(sessionId: number): Promise<TaskState | null>
  saveTaskState(sessionId: number, state: TaskState): Promise<void>
  appendMessage(
    sessionId: number,
    role: 'user' | 'assistant' | 'task',
    content: string,
    run?: unknown,
  ): Promise<void>
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

export function silentRun(taskState: TaskState | null): AgentRunResult {
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

export function mergeUsage(
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

function eventFromHistory(next: TaskState, prev: TaskState): TaskEvent | null {
  const transition =
    next.history.length > prev.history.length ? next.history.at(-1) : undefined
  return transition ? transitionEvent(transition) : null
}

export function rejectionNote(
  rejection: TaskRejection | null,
  state: TaskState | null,
): string | null {
  if (!rejection) {
    return null
  }
  const stay = state?.stage ?? rejection.from
  return `Попытка перейти ${rejection.from} → ${rejection.to} отклонена: ${rejection.reason} Оставайся на этапе ${stay} и продолжай по плану.`
}

function withAgentAction(analysis: TaskAnalysis): TaskAnalysis {
  const description =
    analysis.expectedAction.description.trim() || analysis.step
  return {
    ...analysis,
    expectedAction: { actor: 'agent', description },
  }
}

export type TaskOutcome = {
  taskState: TaskState | null
  taskEvent: TaskEvent | null
  changed: boolean
  usage: SummaryUsage | null
  rejection: TaskRejection | null
}

export async function resolveTaskState(
  input: {
    enabled: boolean
    sessionId: number
    rows: Array<{ role: 'user' | 'assistant'; content: string }>
    user: string
    at: string
  },
  store: Pick<TaskTurnStore, 'getTaskState'>,
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

  const consent =
    analysis.stage === 'execution' && looksLikeApproval(input.user)

  let rejection: TaskRejection | null = null
  const planIncomplete = analysis.expectedAction.actor === 'user'
  if (
    !consent &&
    current.stage === 'planning' &&
    analysis.stage === 'execution' &&
    planIncomplete
  ) {
    rejection = {
      from: 'planning',
      to: 'execution',
      reason:
        'В плане остались незакрытые пункты — сначала утвердите все пункты.',
    }
    analysis = { ...analysis, stage: 'planning' }
  }

  if (
    current.stage === 'execution' &&
    analysis.stage === 'planning' &&
    !looksLikeCorrection(input.user)
  ) {
    analysis = { ...analysis, stage: 'execution' }
  }

  if (current.stage === 'execution' && analysis.stage === 'validation') {
    analysis = { ...analysis, stage: 'execution' }
  }

  if ((consent || current.approved) && analysis.stage === 'execution') {
    analysis = withAgentAction(analysis)
  }

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

export type TaskBegin = { halt: AgentExecution } | { preEvents: TaskEvent[] }

export async function beginTaskTurn(
  input: {
    enabled: boolean
    sessionId: number
    user: string
    at: string
  },
  store: TaskTurnStore,
): Promise<TaskBegin> {
  if (!input.enabled) {
    return { preEvents: [] }
  }
  const started = await store.getTaskState(input.sessionId)

  if (looksLikeCancel(input.user) && started && started.stage !== 'cancelled') {
    const cancelled = cancelTask(started, input.at)
    if (cancelled !== started) {
      await store.saveTaskState(input.sessionId, cancelled)
      await store.appendMessage(input.sessionId, 'user', input.user)
      const event = eventFromHistory(cancelled, started)
      if (event) {
        await store.appendMessage(input.sessionId, 'task', '', event)
      }
      return {
        halt: {
          run: silentRun(cancelled),
          auxUsage: null,
          taskState: cancelled,
        },
      }
    }
  }

  if (started?.stage === 'paused') {
    if (looksLikeResume(input.user)) {
      const resumed = resumeTask(started, input.at)
      if (resumed !== started) {
        await store.saveTaskState(input.sessionId, resumed)
        const event = eventFromHistory(resumed, started)
        if (event) {
          return { preEvents: [event] }
        }
      }
    } else {
      await store.appendMessage(input.sessionId, 'user', input.user)
      return {
        halt: { run: silentRun(started), auxUsage: null, taskState: started },
      }
    }
  }

  return { preEvents: [] }
}

export function resolveCorrection(
  state: TaskState,
  user: string,
  at: string,
): { state: TaskState; event: TaskEvent } | null {
  if (state.stage !== 'validation' || !looksLikeCorrection(user)) {
    return null
  }
  const correction = advanceToExecution(state, at)
  return correction
    ? { state: correction.state, event: correction.event }
    : null
}

export type TaskCompletion = {
  state: TaskState | null
  changed: boolean
  concurrentPause: boolean
  events: TaskEvent[]
}

export async function completeTaskTurn(
  input: {
    sessionId: number
    activeState: TaskState | null
    run: AgentRunResult
    user: string
    now: Date
    at: string
    stateChanged: boolean
    preEvents: TaskEvent[]
    taskEvent: TaskEvent | null
    rejection: TaskRejection | null
    correctionEvent: TaskEvent | null
  },
  store: Pick<TaskTurnStore, 'getTaskState' | 'saveTaskState'>,
): Promise<TaskCompletion> {
  const persisted = await store.getTaskState(input.sessionId)
  const concurrentPause =
    persisted?.stage === 'paused' && input.activeState?.stage !== 'paused'

  const events: TaskEvent[] = [...input.preEvents]
  if (input.rejection) {
    events.push({
      kind: 'rejected',
      from: input.rejection.from,
      to: input.rejection.to,
      reason: input.rejection.reason,
      at: input.at,
    })
  }

  if (concurrentPause) {
    return {
      state: persisted,
      changed: false,
      concurrentPause: true,
      events,
    }
  }

  let state = input.activeState
  let changed = input.stateChanged
  const advance = advanceAfterRun(
    input.activeState,
    input.run,
    input.now.toISOString(),
    input.user,
  )
  if (advance) {
    state = advance.state
    changed = true
  }
  if (input.taskEvent) {
    events.push(input.taskEvent)
  }
  if (input.correctionEvent) {
    events.push(input.correctionEvent)
  }
  if (advance) {
    events.push(advance.event)
  }
  if (changed && state) {
    await store.saveTaskState(input.sessionId, state)
  }
  return { state, changed, concurrentPause: false, events }
}
