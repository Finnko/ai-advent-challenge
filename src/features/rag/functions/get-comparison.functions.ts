import { createServerFn } from '@tanstack/react-start'
import { getComparison } from '../server/rag.server'

export const getComparisonFn = createServerFn({ method: 'GET' }).handler(
  async () => getComparison(),
)
