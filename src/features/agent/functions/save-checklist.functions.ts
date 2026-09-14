import { createServerFn } from '@tanstack/react-start'
import { saveScenarioChecklist } from '../server/store.server'
import { asObject, requireText, requireToken } from './validation'

function requireItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('Некорректный чеклист')
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

export const saveChecklist = createServerFn({ method: 'POST' })
  .validator((input: { token: string; scenario: string; items: string[] }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      scenario: requireText(data.scenario, 'Сценарий обязателен'),
      items: requireItems(data.items),
    }
  })
  .handler(async ({ data }) => {
    await saveScenarioChecklist(data.token, data.scenario, data.items)
    return { ok: true } as const
  })
