import { asObject, requireText } from '@lib/functions/validation'
import type { AnswerGenerator } from '../types'

export function requireQuestion(value: unknown): string {
  const question = requireText(value, 'Вопрос обязателен')
  if (question.length > 500) {
    throw new Error('Вопрос длиннее 500 символов')
  }
  return question
}

export function optionalGenerator(
  value: unknown,
  fallback: AnswerGenerator = 'cloud',
): AnswerGenerator {
  if (value === undefined || value === null) {
    return fallback
  }
  if (value !== 'cloud' && value !== 'local') {
    throw new Error('Неизвестный генератор ответа')
  }
  return value
}

export function parseAnswerInput(value: unknown): {
  question: string
  generator: AnswerGenerator
} {
  const data = asObject(value)
  return {
    question: requireQuestion(data.question),
    generator: optionalGenerator(data.generator),
  }
}

export function requireGoal(value: unknown): string {
  const goal = requireText(value, 'Цель обязательна')
  if (goal.length > 1000) {
    throw new Error('Цель длиннее 1000 символов')
  }
  return goal
}

export function parseFileTaskInput(value: unknown): {
  goal: string
  generator: AnswerGenerator
  scenario: string | null
} {
  const data = asObject(value)
  const scenario = data.scenario
  return {
    goal: requireGoal(data.goal),
    generator: optionalGenerator(data.generator),
    scenario:
      typeof scenario === 'string' && scenario.trim().length > 0
        ? scenario.trim()
        : null,
  }
}

export function requireTaskId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Некорректный id задачи')
  }
  return value
}

export function parseApproveFileTaskInput(value: unknown): {
  taskId: number
  generator: AnswerGenerator
} {
  const data = asObject(value)
  return {
    taskId: requireTaskId(data.taskId),
    generator: optionalGenerator(data.generator),
  }
}
