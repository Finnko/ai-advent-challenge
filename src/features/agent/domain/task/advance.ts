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

const FUZZY_APPROVAL_MIN_LENGTH = 5

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

export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) {
    return true
  }
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) {
    return false
  }
  if (la === lb) {
    let first = -1
    let second = -1
    for (let index = 0; index < la; index += 1) {
      if (a[index] !== b[index]) {
        if (first === -1) {
          first = index
        } else if (second === -1) {
          second = index
        } else {
          return false
        }
      }
    }
    if (second === -1) {
      return first !== -1
    }
    return (
      second === first + 1 &&
      a[first] === b[second] &&
      a[second] === b[first]
    )
  }
  const shorter = la < lb ? a : b
  const longer = la < lb ? b : a
  let i = 0
  let j = 0
  let skipped = false
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1
      j += 1
    } else if (!skipped) {
      skipped = true
      j += 1
    } else {
      return false
    }
  }
  return true
}

function fuzzyApprovalWord(word: string): boolean {
  if (word.length < FUZZY_APPROVAL_MIN_LENGTH) {
    return false
  }
  return APPROVAL_WORDS.some(
    (candidate) =>
      candidate.length >= FUZZY_APPROVAL_MIN_LENGTH &&
      candidate[0] === word[0] &&
      withinOneEdit(word, candidate),
  )
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
  if (APPROVAL_WORDS.some((word) => containsWord(lower, word))) {
    return true
  }
  return lower
    .split(/[^а-яёa-z]+/u)
    .filter((word) => word.length > 0)
    .some(fuzzyApprovalWord)
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

export function hasSuccessfulAction(
  run: Pick<AgentRunResult, 'trace'>,
): boolean {
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
    state.stage === 'execution' &&
    hasSuccessfulAction(run) &&
    state.steps.length > 0
  ) {
    return (
      advanceStep(state, at) ??
      advanceStage(
        state,
        'validation',
        at,
        'Шаги плана выполнены — переходим к проверке результата.',
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
