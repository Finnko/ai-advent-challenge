import { createServerFn } from '@tanstack/react-start'
import { asObject } from '@lib/functions/validation'
import { search } from '../server/rag.server'
import {
  optionalBoolean,
  optionalCandidateK,
  optionalK,
  optionalThreshold,
  requireChunkingStrategy,
  requireQuery,
} from './validation'

export const searchIndex = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const data = asObject(input)
    return {
      strategy: requireChunkingStrategy(data.strategy),
      query: requireQuery(data.query),
      k: optionalK(data.k),
      candidateK: optionalCandidateK(data.candidateK),
      rerank: optionalBoolean(data.rerank, false),
      rewrite: optionalBoolean(data.rewrite, false),
      threshold: optionalThreshold(data.threshold),
    }
  })
  .handler(async ({ data }) => search(data))
