import type { Difficulty, Topic } from '../domain/types'

export const TOPICS: Topic[] = [
  {
    id: 'history',
    label: 'История',
    prompt: 'всемирная история и история России',
  },
  {
    id: 'science',
    label: 'Наука',
    prompt: 'естественные науки: физика, химия, биология',
  },
  {
    id: 'it',
    label: 'IT',
    prompt: 'информационные технологии и программирование',
  },
  {
    id: 'geography',
    label: 'География',
    prompt: 'география, страны и столицы',
  },
  { id: 'movies', label: 'Кино', prompt: 'кино и сериалы' },
  { id: 'sports', label: 'Спорт', prompt: 'спорт и крупные соревнования' },
]

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Простой',
  medium: 'Средний',
  hard: 'Сложный',
}

export function randomTopic(): Topic {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)]
}

export function resolveTopic(input?: string): Topic {
  const value = input?.trim()
  if (!value) {
    return randomTopic()
  }
  const lower = value.toLowerCase()
  const known = TOPICS.find(
    (topic) => topic.id === lower || topic.label.toLowerCase() === lower,
  )
  if (known) {
    return known
  }
  return { id: 'custom', label: value, prompt: value }
}
