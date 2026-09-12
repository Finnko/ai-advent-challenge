import { createServerFn } from '@tanstack/react-start'
import { CHAT_CONFIGS } from '../day2'
import type { ChatMode } from '../day2'
import { DEEPSEEK_ENDPOINT } from '../llm'
import { apiKeyFor, callCompletions, requireEnv } from '../llm.server'
import { asObject, requireChatMode, requireText } from './validation'

export const chat = createServerFn({ method: 'POST' })
  .validator((input: { prompt: string; mode: ChatMode }) => {
    const data = asObject(input)
    return {
      prompt: requireText(data.prompt, 'Промпт обязателен'),
      mode: requireChatMode(data.mode),
    }
  })
  .handler(async ({ data }) => {
    const config = CHAT_CONFIGS[data.mode]
    const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
    const endpoint = {
      ...DEEPSEEK_ENDPOINT,
      model: requireEnv('DEEPSEEK_MODEL'),
    }
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: config.system },
        { role: 'user', content: data.prompt },
      ],
      config.params,
    )
  })
