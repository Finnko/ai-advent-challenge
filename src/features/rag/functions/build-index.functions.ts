import { createServerFn } from '@tanstack/react-start'
import { buildAllIndexes, buildStrategyIndex } from '../server/rag.server'
import { parseBuildInput } from './validation'

export const buildIndex = createServerFn({ method: 'POST' })
  .validator(parseBuildInput)
  .handler(async ({ data }) => {
    if (data === 'all') {
      return { results: await buildAllIndexes() }
    }
    return { results: [await buildStrategyIndex(data)] }
  })
