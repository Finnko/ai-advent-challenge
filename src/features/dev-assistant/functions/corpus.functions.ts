import { createServerFn } from '@tanstack/react-start'
import { getDevAssistantCorpus } from '../server/service.server'

export const listAssistantCorpus = createServerFn({ method: 'GET' }).handler(
  async () => getDevAssistantCorpus(),
)
