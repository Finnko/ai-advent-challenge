import { createServerFn } from '@tanstack/react-start'
import { getDevAssistantIndexStats } from '../server/service.server'

export const getAssistantIndexStats = createServerFn({
  method: 'GET',
}).handler(async () => getDevAssistantIndexStats())
