import { createServerFn } from '@tanstack/react-start'
import { getScenarioChecklist } from '../server/store.server'
import { asObject, requireText, requireToken } from './validation'

export const getChecklist = createServerFn({ method: 'POST' })
  .validator((input: { token: string; scenario: string }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      scenario: requireText(data.scenario, 'Сценарий обязателен'),
    }
  })
  .handler(async ({ data }) =>
    getScenarioChecklist(data.token, data.scenario),
  )
