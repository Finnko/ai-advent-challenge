import { createServerFn } from '@tanstack/react-start'
import { TIER_ENDPOINTS } from '../llm'
import type { Tier } from '../llm'
import { apiKeyFor, callCompletions } from '../llm.server'
import { asObject, requireText, requireTier } from './validation'

export const askModel = createServerFn({ method: 'POST' })
  .validator((input: { tier: Tier; system: string; user: string }) => {
    const data = asObject(input)
    return {
      tier: requireTier(data.tier),
      system: requireText(data.system, 'Системный промпт обязателен'),
      user: requireText(data.user, 'Пользовательский промпт обязателен'),
    }
  })
  .handler(async ({ data }) => {
    const endpoint = TIER_ENDPOINTS[data.tier]
    const apiKeyEnv =
      data.tier === 'weak' ? 'HUGGING_FACE_TOKEN' : 'DEEPSEEK_API_KEY'
    const apiKey = apiKeyFor(apiKeyEnv)
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: data.system },
        { role: 'user', content: data.user },
      ],
      {},
    )
  })
