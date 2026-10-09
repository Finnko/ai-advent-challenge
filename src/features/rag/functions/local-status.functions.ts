import { createServerFn } from '@tanstack/react-start'
import { getRagLlmStatus } from '../server/rag.server'

export const ragLlmStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => getRagLlmStatus(),
)
