import type { Difficulty, Topic } from '../domain/types'

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: 'Простые вопросы на общую эрудицию, ответ очевиден для большинства.',
  medium: 'Вопросы средней сложности: нужны конкретные знания по теме.',
  hard: 'Сложные вопросы: детали, даты, узкие факты.',
}

export function buildQuestionPrompt(input: {
  topic: Topic
  difficulty: Difficulty
}): { system: string; user: string } {
  const system = [
    'Ты — генератор вопросов для викторины.',
    'Придумай ровно один вопрос с четырьмя вариантами ответа, из которых верный ровно один.',
    'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений, по схеме:',
    '{"question": string, "options": [string, string, string, string], "correctIndex": 0|1|2|3, "explanation": string}',
    'Поле explanation — короткое пояснение правильного ответа на русском.',
    'Факты должны быть достоверными.',
  ].join('\n')

  const user = [
    `Тема: ${input.topic.prompt}.`,
    `Сложность: ${DIFFICULTY_HINTS[input.difficulty]}`,
    'Верни один свежий вопрос в формате JSON.',
  ].join('\n')

  return { system, user }
}
