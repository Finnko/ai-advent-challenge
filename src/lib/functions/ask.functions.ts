import { createServerFn } from '@tanstack/react-start'
import { DEEPSEEK_ENDPOINT } from '../llm'
import type { AskParams } from '../llm'
import { apiKeyFor, callCompletions, requireEnv } from '../llm.server'
import { asObject, requireText } from './validation'

export const ask = createServerFn({ method: 'POST' })
  .validator((input: { system: string; user: string; params?: AskParams }) => {
    const data = asObject(input)
    const params = (data.params ?? {}) as AskParams
    if (
      params.temperature !== undefined &&
      (typeof params.temperature !== 'number' ||
        !Number.isFinite(params.temperature) ||
        params.temperature < 0 ||
        params.temperature > 2)
    ) {
      throw new Error('temperature должна быть числом от 0 до 2')
    }
    return {
      system: requireText(data.system, 'Системный промпт обязателен'),
      user: requireText(data.user, 'Пользовательский промпт обязателен'),
      params,
    }
  })
  .handler(async ({ data }) => {
    const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
    const endpoint = {
      ...DEEPSEEK_ENDPOINT,
      model: requireEnv('DEEPSEEK_MODEL'),
    }
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: data.system },
        { role: 'user', content: data.user },
      ],
      data.params,
    )
  })
