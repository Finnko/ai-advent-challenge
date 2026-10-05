import { createServerFn } from '@tanstack/react-start'
import { getLocalLlmStatus } from '../server/local-llm.server'

export const localLlmStatus = createServerFn({ method: 'GET' }).handler(
  async () => getLocalLlmStatus(),
)
