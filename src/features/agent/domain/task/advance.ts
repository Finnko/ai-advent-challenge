import type { AgentRunResult } from '../agent'
import { isMutatingTool } from '../agent-tools'
import { transitionTask } from './state'
import type { TaskEvent, TaskState, TaskStage } from './types'

export type TaskAdvance = {
  state: TaskState
  event: TaskEvent
}

const EXECUTION_FIX_STEPS = ['Исправить результат']
const VALIDATION_DEFAULT_STEPS = ['Сверить результат']

const CORRECTION_HINTS =
  /неверн|не\s+верно|неправильн|передел|исправ|заново|не получил|ошибк|не так|\bне то\b|на самом деле/u

const RESUME_HINTS = /продолж|дальше|вернись|возобнов|resume|go on/u

const APPROVAL_WORDS = [
  'да',
  'ок',
  'окей',
  'приступай',
  'приступайте',
  'приступаем',
  'начинай',
  'начинайте',
  'начинаем',
  'поехали',
  'делаем',
  'верно',
  'согласен',
  'согласна',
  'подтверждаю',
  'утверждаю',
]

const APPROVAL_PHRASES = ['всё верно', 'все верно']

const WORD_PATTERN_CACHE = new Map<string, RegExp>()

function containsWord(text: string, word: string): boolean {
  let pattern = WORD_PATTERN_CACHE.get(word)
  if (!pattern) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    pattern = new RegExp(
      `(?:^|[^а-яёa-z])${escaped}(?:[^а-яёa-z]|$)`,
      'u',
    )
    WORD_PATTERN_CACHE.set(word, pattern)
  }
  return pattern.test(text)
}

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

export function looksLikeApproval(text: string): boolean {
  const lower = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (looksLikeCorrection(lower)) {
    return false
  }
  if (APPROVAL_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true
  }
  return APPROVAL_WORDS.some((word) => containsWord(lower, word))
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
