import { createServerFn } from '@tanstack/react-start'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export type ChatMode = 'free' | 'constrained'

export type ChatUsage = {
  prompt_tokens: number
  completion_tokens: number
}

export type ChatResult = {
  content: string
  usage: ChatUsage | null
}

type DeepSeekResponse = {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

type DeepSeekParams = {
  max_tokens?: number
  stop?: string[]
  response_format?: { type: 'json_object' }
}

export type AskParams = DeepSeekParams

async function callDeepSeek(
  messages: { role: 'system' | 'user'; content: string }[],
  params: DeepSeekParams = {},
): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const model = process.env.DEEPSEEK_MODEL

  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY не задан. Скопируй .env.example в .env и впиши свой ключ.',
    )
  }
  if (!model) {
    throw new Error('DEEPSEEK_MODEL не задан.')
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      thinking: { type: 'disabled' },
      ...params,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ошибка DeepSeek API (${res.status}): ${body}`)
  }

  const dataJson = (await res.json()) as DeepSeekResponse

  const content = dataJson.choices?.[0]?.message?.content ?? ''

  const usage =
    typeof dataJson.usage?.prompt_tokens === 'number' &&
    typeof dataJson.usage?.completion_tokens === 'number'
      ? {
          prompt_tokens: dataJson.usage.prompt_tokens,
          completion_tokens: dataJson.usage.completion_tokens,
        }
      : null

  return { content, usage } satisfies ChatResult
}

const FREE_SYSTEM = 'Ты — полезный ассистент.'

const CONSTRAINED_SYSTEM = [
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

export const chat = createServerFn({ method: 'POST' })
  .validator((input: { prompt: string; mode: ChatMode }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    const { prompt, mode } = input
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Промпт обязателен')
    }
    if (mode !== 'free' && mode !== 'constrained') {
      throw new Error('Неизвестный режим')
    }
    return { prompt: prompt.trim(), mode }
  })
  .handler(async ({ data }) => {
    const { prompt, mode } = data
    const config = CHAT_CONFIGS[mode]
    return callDeepSeek(
      [
        { role: 'system', content: config.system },
        { role: 'user', content: prompt },
      ],
      config.params,
    )
  })

export const ask = createServerFn({ method: 'POST' })
  .validator((input: { system: string; user: string; params?: AskParams }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    const { system, user, params } = input
    if (typeof system !== 'string' || system.trim().length === 0) {
      throw new Error('Системный промпт обязателен')
    }
    if (typeof user !== 'string' || user.trim().length === 0) {
      throw new Error('Пользовательский промпт обязателен')
    }
    return {
      system: system.trim(),
      user: user.trim(),
      params: params ?? {},
    }
  })
  .handler(async ({ data }) =>
    callDeepSeek(
      [
        { role: 'system', content: data.system },
        { role: 'user', content: data.user },
      ],
      data.params,
    ),
  )
