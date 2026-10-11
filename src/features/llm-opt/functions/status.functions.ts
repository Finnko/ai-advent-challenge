import { createServerFn } from '@tanstack/react-start'
import { getLocalLlmStatus } from '@lib/local-llm.server'

export const llmOptStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => getLocalLlmStatus(),
)
