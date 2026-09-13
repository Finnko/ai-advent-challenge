export type ChatMode = 'free' | 'constrained'

export const FREE_SYSTEM = 'Ты — полезный ассистент.'

export const CONSTRAINED_SYSTEM = [
  'Ответь ровно одним json-объектом и ничем больше. Без markdown и код-фенсов: ничего до "{" и ничего после "}".',
  'Обязательные ключи:',
  '- "title": string, короткий заголовок темы',
  '- "summary": string, краткое резюме не длиннее 150 слов',
  '- "keywords": string[], от 3 до 5 коротких тегов',
  'Пример вывода:',
  '{ "title": "Почему небо голубое", "summary": "Небо выглядит голубым, потому что молекулы воздуха рассеивают коротковолновый свет сильнее, чем длинноволновый.", "keywords": ["рассеяние", "свет", "атмосфера"] }',
  'После закрывающей "}" json-объекта выведи дословный маркер END и остановись. Больше ничего не выводи.',
].join('\n')

export const CHAT_CONFIGS: Record<
  ChatMode,
  {
    label: string
    description: string
    system: string
    params: {
      max_tokens?: number
      stop?: string[]
      response_format?: { type: 'json_object' }
    }
  }
> = {
  free: {
    label: 'Свободная форма',
    description: 'Без ограничений формата, длины и завершения.',
    system: FREE_SYSTEM,
    params: {},
  },
  constrained: {
    label: 'С ограничениями',
    description: 'Явный JSON-формат, бюджет max_tokens, стоп-маркер END.',
    system: CONSTRAINED_SYSTEM,
    params: {
      max_tokens: 400,
      stop: ['END'],
      response_format: { type: 'json_object' },
    },
  },
}
