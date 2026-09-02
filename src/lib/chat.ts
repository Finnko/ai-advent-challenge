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

const FREE_SYSTEM = 'You are a helpful assistant.'

const CONSTRAINED_SYSTEM = [
  'Respond with exactly one json object and nothing else. No markdown, no code fences, nothing before "{" and nothing after "}".',
  'Required keys:',
  '- "title": string, a short heading for the topic',
  '- "summary": string, a concise summary of at most 150 words',
  '- "keywords": string[], 3 to 5 short tags',
  'Example output:',
  '{ "title": "Why the sky is blue", "summary": "The sky looks blue because air molecules scatter short-wavelength light more than long-wavelength light.", "keywords": ["scattering", "light", "atmosphere"] }',
  'After the closing "}" of the json object, output the literal marker END and stop. Nothing else.',
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
    label: 'Free form',
    description: 'No format, length or completion constraints.',
    system: FREE_SYSTEM,
    params: {},
  },
  constrained: {
    label: 'Constrained',
    description: 'Explicit JSON format, max_tokens budget, END stop guard.',
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
      throw new Error('Invalid request')
    }
    const { prompt, mode } = input
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required')
    }
    if (mode !== 'free' && mode !== 'constrained') {
      throw new Error('Unknown mode')
    }
    return { prompt: prompt.trim(), mode }
  })
  .handler(async ({ data }) => {
    const { prompt, mode } = data
    const apiKey = process.env.DEEPSEEK_API_KEY
    const model = process.env.DEEPSEEK_MODEL

    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY is not set. Copy .env.example to .env and fill in your key.',
      )
    }
    if (!model) {
      throw new Error('DEEPSEEK_MODEL is not set.')
    }

    const config = CHAT_CONFIGS[mode]

    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: config.system },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
        ...config.params,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`DeepSeek API error (${res.status}): ${body}`)
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
  })
