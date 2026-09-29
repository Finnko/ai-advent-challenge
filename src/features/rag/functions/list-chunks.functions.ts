import { createServerFn } from '@tanstack/react-start'
import { asObject } from '@lib/functions/validation'
import { listChunksFor } from '../server/rag.server'
import { requireChunkingStrategy } from './validation'

export const listChunks = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const data = asObject(input)
    const limit =
      typeof data.limit === 'number' && Number.isFinite(data.limit)
        ? Math.min(200, Math.max(1, Math.floor(data.limit)))
        : 50
    return { strategy: requireChunkingStrategy(data.strategy), limit }
  })
  .handler(async ({ data }) => listChunksFor(data.strategy, data.limit))
