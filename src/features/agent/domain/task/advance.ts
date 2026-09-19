import type { AgentRunResult } from '../agent'
import { isMutatingTool } from '../agent-tools'
import { canTransition, transitionEvent } from './state'
import type { TaskEvent, TaskState, TaskStage, TaskTransition } from './types'
import { TASK_HISTORY_LIMIT } from './types'

export type TaskAdvance = {
  state: TaskState
  event: TaskEvent
}

const EXECUTION_FIX_STEPS = ['Исправить результат']
const VALIDATION_DEFAULT_STEPS = ['Сверить результат']

const CORRECTION_HINTS =
  /неверн|неправильн|передел|исправ|заново|не получил|ошибк|не так|\bне то\b|на самом деле/u

const RESUME_HINTS = /продолж|дальше|вернись|возобнов|resume|go on/u

const CANCEL_PHRASES = [
  'задача отменена',
  'отменить задачу',
  'отмена задачи',
  'отмени задачу',
  'задачу отменить',
]

export function looksLikeCorrection(text: string): boolean {
  return CORRECTION_HINTS.test(text.trim().toLowerCase())
}

export function looksLikeResume(text: string): boolean {
  return RESUME_HINTS.test(text.trim().toLowerCase())
}

export function looksLikeCancel(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  return CANCEL_PHRASES.some((phrase) => normalized.includes(phrase))
}

export function hasSuccessfulMutation(
  run: Pick<AgentRunResult, 'trace'>,
): boolean {
  return run.trace.some(
    (step) =>
      step.stage === 'act' && step.outcome.ok && isMutatingTool(step.tool),
  )
}

export function hasReadonlyVerification(
  run: Pick<AgentRunResult, 'trace'>,
): boolean {
  return run.trace.some(
    (step) =>
      step.stage === 'act' && step.outcome.ok && !isMutatingTool(step.tool),
  )
}

function advanceStage(
  state: TaskState,
  to: TaskStage,
  at: string,
  reason: string,
  steps: string[],
): TaskAdvance | null {
  if (state.stage === to || !canTransition(state.stage, to)) {
    return null
  }
  const transition: TaskTransition = {
    from: state.stage,
    to,
    reason,
    at,
  }
  const plan = [...steps]
  const nextStep = plan[0] ?? ''
  return {
    state: {
      ...state,
      stage: to,
      previousStage: null,
      step: nextStep,
      steps: plan,
      stepIndex: 0,
      expectedAction: { actor: 'agent', description: nextStep },
      updatedAt: at,
      history: [...state.history, transition].slice(-TASK_HISTORY_LIMIT),
    },
    event: transitionEvent(transition),
  }
}

export function advanceStep(state: TaskState, at: string): TaskAdvance | null {
  const nextIndex = state.stepIndex + 1
  if (nextIndex >= state.steps.length) {
    return null
  }
  const from = state.steps[state.stepIndex] ?? state.step
  const to = state.steps[nextIndex]
  return {
    state: {
      ...state,
      step: to,
      stepIndex: nextIndex,
      expectedAction: { actor: 'agent', description: to },
      updatedAt: at,
    },
    event: { kind: 'step', from, to, index: nextIndex, at },
  }
}

export function advanceToExecution(
  state: TaskState,
  at: string,
): TaskAdvance | null {
  return advanceStage(
    state,
    'execution',
    at,
    'Пользователь сообщил, что результат неверен — возвращаемся к исполнению.',
    EXECUTION_FIX_STEPS,
  )
}

export function advanceAfterRun(
  state: TaskState | null,
  run: Pick<AgentRunResult, 'trace' | 'blocked'>,
  at: string,
  user = '',
): TaskAdvance | null {
  if (!state || run.blocked) {
    return null
  }
  if (state.stage === 'execution' && hasSuccessfulMutation(run)) {
    return (
      advanceStep(state, at) ??
      advanceStage(
        state,
        'validation',
        at,
        'Действие выполнено — переходим к проверке результата.',
        VALIDATION_DEFAULT_STEPS,
      )
    )
  }
  if (
    state.stage === 'validation' &&
    hasReadonlyVerification(run) &&
    !looksLikeCorrection(user)
  ) {
    return (
      advanceStep(state, at) ??
      advanceStage(
        state,
        'done',
        at,
        'Результат проверен — задача завершена.',
        [],
      )
    )
  }
  return null
}
