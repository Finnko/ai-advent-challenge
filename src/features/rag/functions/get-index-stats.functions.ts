import { createServerFn } from '@tanstack/react-start'
import { getIndexStats } from '../server/rag.server'

export const getIndexStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => getIndexStats(),
)
