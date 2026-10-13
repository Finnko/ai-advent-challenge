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
