import { createServerFn } from '@tanstack/react-start'
import { buildDevAssistantIndex } from '../server/service.server'

export const buildAssistantIndex = createServerFn({
  method: 'POST',
}).handler(async () => buildDevAssistantIndex())
