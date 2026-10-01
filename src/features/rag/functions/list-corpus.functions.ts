import { createServerFn } from '@tanstack/react-start'
import { getCorpus } from '../server/rag.server'

export const listCorpus = createServerFn({ method: 'GET' }).handler(async () =>
  getCorpus(),
)
