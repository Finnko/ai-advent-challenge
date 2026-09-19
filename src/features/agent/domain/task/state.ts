import type {
  TaskActor,
  TaskEvent,
  TaskExpectedAction,
  TaskStage,
  TaskState,
  TaskTransition,
} from './types'
import {
  TASK_EXPECTED_MAX,
  TASK_HISTORY_LIMIT,
  TASK_STEP_MAX,
  TASK_STEPS_MAX,
  TASK_TITLE_MAX,
  isTaskActor,
  isTerminalTaskStage,
} from './types'

export type TaskAnalysis = {
  title?: string | null
  stage: TaskStage
  step: string
  steps?: string[]
  expectedAction: { actor: TaskActor; description: string }
  reason?: string | null
}

const ALLOWED_TRANSITIONS: Record<TaskStage, TaskStage[]> = {
  planning: ['execution', 'paused', 'cancelled'],
  execution: ['validation', 'planning', 'paused', 'cancelled'],
  validation: ['done', 'execution', 'paused', 'cancelled'],
  paused: ['planning', 'execution', 'validation', 'cancelled'],
  done: ['planning'],
  cancelled: ['planning'],
}

export function canTransition(from: TaskStage, to: TaskStage): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to)
}

function clampText(value: string, max: number): string {
  return value.trim().slice(0, max)
}

function normalizeSteps(steps: unknown, fallback: string): string[] {
  const list = Array.isArray(steps)
    ? steps
        .filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0,
        )
        .map((entry) => clampText(entry, TASK_STEP_MAX))
        .slice(0, TASK_STEPS_MAX)
    : []
  if (list.length > 0) {
    return list
  }
  const single = clampText(fallback, TASK_STEP_MAX)
  return single.length > 0 ? [single] : []
}

function normalizeExpected(action: {
  actor?: unknown
  description?: unknown
}): TaskExpectedAction {
  const actor: TaskActor = isTaskActor(action?.actor) ? action.actor : 'agent'
  const description =
    typeof action?.description === 'string'
      ? clampText(action.description, TASK_EXPECTED_MAX)
      : ''
  return { actor, description }
}

function pushHistory(
  history: TaskTransition[],
  transition: TaskTransition,
): TaskTransition[] {
  return [...history, transition].slice(-TASK_HISTORY_LIMIT)
}

function nextPreviousStage(state: TaskState, to: TaskStage): TaskStage | null {
  if (to === 'paused') {
    return state.stage
  }
  if (state.stage === 'paused') {
    return null
  }
  return state.previousStage
}

export function transitionEvent(transition: TaskTransition): TaskEvent {
  return {
    kind: 'transition',
    from: transition.from,
    to: transition.to,
    reason: transition.reason,
    at: transition.at,
  }
}

export function createTaskState(analysis: TaskAnalysis, at: string): TaskState {
  const title = clampText(analysis.title ?? '', TASK_TITLE_MAX) || 'Задача'
  const steps = normalizeSteps(analysis.steps, analysis.step)
  return {
    title,
    stage: 'planning',
    previousStage: null,
    step: steps[0] ?? clampText(analysis.step, TASK_STEP_MAX),
    steps,
    stepIndex: 0,
    expectedAction: normalizeExpected(analysis.expectedAction),
    updatedAt: at,
    history: [],
  }
}

export function applyAnalysis(
  state: TaskState,
  analysis: TaskAnalysis,
  at: string,
): TaskState {
  const title =
    clampText(analysis.title ?? '', TASK_TITLE_MAX) || state.title
  const stageChanged = analysis.stage !== state.stage
  let steps = state.steps
  let stepIndex = state.stepIndex
  if (stageChanged) {
    steps = normalizeSteps(analysis.steps, analysis.step)
    stepIndex = 0
  } else if (Array.isArray(analysis.steps) && analysis.steps.length > 0) {
    steps = normalizeSteps(analysis.steps, analysis.step)
    stepIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0))
  }
  const described: TaskState = {
    ...state,
    title,
    step: steps[stepIndex] ?? clampText(analysis.step, TASK_STEP_MAX),
    steps,
    stepIndex,
    expectedAction: normalizeExpected(analysis.expectedAction),
    updatedAt: at,
  }

  if (analysis.stage === state.stage) {
    return described
  }
  if (!canTransition(state.stage, analysis.stage)) {
    return state
  }

  const transition: TaskTransition = {
    from: state.stage,
    to: analysis.stage,
    reason: analysis.reason?.trim() || 'Обновление состояния',
    at,
  }
  return {
    ...described,
    stage: analysis.stage,
    previousStage: nextPreviousStage(state, analysis.stage),
    history: pushHistory(state.history, transition),
  }
}

export function pauseTask(
  state: TaskState,
  at: string,
  reason = 'Пауза',
): TaskState {
  if (state.stage === 'paused' || isTerminalTaskStage(state.stage)) {
    return state
  }
  const transition: TaskTransition = {
    from: state.stage,
    to: 'paused',
    reason,
    at,
  }
  return {
    ...state,
    stage: 'paused',
    previousStage: state.stage,
    expectedAction: {
      actor: 'user',
      description: 'Продолжить задачу, когда будете готовы.',
    },
    updatedAt: at,
    history: pushHistory(state.history, transition),
  }
}

export function resumeTask(
  state: TaskState,
  at: string,
  reason = 'Продолжение',
): TaskState {
  if (state.stage !== 'paused') {
    return state
  }
  const target = state.previousStage ?? 'planning'
  const transition: TaskTransition = {
    from: 'paused',
    to: target,
    reason,
    at,
  }
  return {
    ...state,
    stage: target,
    previousStage: null,
    updatedAt: at,
    history: pushHistory(state.history, transition),
  }
}

export function cancelTask(
  state: TaskState,
  at: string,
  reason = 'Отмена',
): TaskState {
  if (isTerminalTaskStage(state.stage)) {
    return state
  }
  const transition: TaskTransition = {
    from: state.stage,
    to: 'cancelled',
    reason,
    at,
  }
  return {
    ...state,
    stage: 'cancelled',
    previousStage: null,
    expectedAction: {
      actor: 'user',
      description: 'Задача отменена.',
    },
    updatedAt: at,
    history: pushHistory(state.history, transition),
  }
}
