import type { LoopTraceStep } from '@lib/agent-loop/types'
import { looksLikeCorrection } from './gates'
import { transitionTask } from './state'
import type { TaskEvent, TaskState, TaskStage } from './types'

export type TaskAdvance = {
  state: TaskState
  event: TaskEvent
}

type LoopRunLike = { trace: LoopTraceStep[]; blocked: boolean }

const EXECUTION_FIX_STEPS = ['Исправить результат']
const VALIDATION_DEFAULT_STEPS = ['Сверить результат']

export function hasSuccessfulMutation(
  run: Pick<LoopRunLike, 'trace'>,
): boolean {
  return run.trace.some(
    (step) => step.stage === 'act' && step.outcome.ok && step.mutating,
  )
}

export function hasReadonlyVerification(
  run: Pick<LoopRunLike, 'trace'>,
): boolean {
  return run.trace.some(
    (step) => step.stage === 'act' && step.outcome.ok && !step.mutating,
  )
}

export function hasSuccessfulAction(run: Pick<LoopRunLike, 'trace'>): boolean {
  return run.trace.some((step) => step.stage === 'act' && step.outcome.ok)
}

function advanceStage(
  state: TaskState,
  to: TaskStage,
  at: string,
  reason: string,
  steps: string[],
): TaskAdvance | null {
  const outcome = transitionTask(state, to, { at, reason, steps })
  if (outcome.status !== 'applied') {
    return null
  }
  return { state: outcome.state, event: outcome.event }
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
  run: Pick<LoopRunLike, 'trace' | 'blocked'>,
  at: string,
  user = '',
): TaskAdvance | null {
  if (!state || run.blocked) {
    return null
  }
  if (state.stage === 'execution' && hasSuccessfulMutation(run)) {
    return advanceStage(
      state,
      'validation',
      at,
      'Действие выполнено — переходим к проверке результата.',
      VALIDATION_DEFAULT_STEPS,
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
