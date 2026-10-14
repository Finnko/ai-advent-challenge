import { createServerFn } from '@tanstack/react-start'
import { askDevAssistant } from '../server/service.server'
import { parseAnswerInput } from './validation'

export const askAssistant = createServerFn({ method: 'POST' })
  .validator(parseAnswerInput)
  .handler(async ({ data }) => askDevAssistant(data))
