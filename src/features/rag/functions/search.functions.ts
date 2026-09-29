import { createServerFn } from '@tanstack/react-start'
import { asObject } from '@lib/functions/validation'
import { search } from '../server/rag.server'
import { optionalK, requireChunkingStrategy, requireQuery } from './validation'

export const searchIndex = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const data = asObject(input)
    return {
      strategy: requireChunkingStrategy(data.strategy),
      query: requireQuery(data.query),
      k: optionalK(data.k),
    }
  })
  .handler(async ({ data }) =>
    search(data.strategy, data.query, data.k),
  )
