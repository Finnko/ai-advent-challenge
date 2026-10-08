import { z } from 'zod'
import type { QuizQuestion } from './types'

const ALLOWED_TEXT =
  /^[\p{Script=Cyrillic}\p{Script=Latin}\p{N}\p{P}\p{Zs}\n\t]+$/u

export function hasDisallowedCharacters(text: string): boolean {
  return !ALLOWED_TEXT.test(text)
}

function hasCleanText(question: QuizQuestion): boolean {
  return [question.question, question.explanation, ...question.options].every(
    (text) => !hasDisallowedCharacters(text),
  )
}

const QuestionSchema: z.ZodType<QuizQuestion> = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1),
  })
  .refine(
    (question) =>
      new Set(question.options.map(normalizeQuestionText)).size ===
      question.options.length,
    { message: 'варианты ответа должны быть различны' },
  )
  .refine(hasCleanText, {
    message: 'в тексте вопроса есть посторонние символы',
  })

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isDuplicateQuestion(
  question: QuizQuestion,
  asked: string[],
): boolean {
  const key = normalizeQuestionText(question.question)
  return asked.some((item) => normalizeQuestionText(item) === key)
}

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match ? match[1] : text
}

export function extractJsonObject(text: string): string | null {
  const source = stripCodeFences(text)
  const start = source.indexOf('{')
  if (start === -1) {
    return null
  }
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }
  return null
}

export function parseQuestion(raw: string): QuizQuestion {
  const json = extractJsonObject(raw)
  if (!json) {
    throw new Error('В ответе модели нет JSON-объекта')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Не удалось разобрать JSON модели')
  }
  const result = QuestionSchema.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(
      `Неверная структура вопроса: ${issue?.message ?? 'unknown'}`,
    )
  }
  return result.data
}
