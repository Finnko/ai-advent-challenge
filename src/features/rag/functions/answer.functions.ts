import { createServerFn } from '@tanstack/react-start'
import { asObject } from '@lib/functions/validation'
import { answer } from '../server/rag.server'
import {
  optionalBoolean,
  optionalK,
  optionalRagPipeline,
  optionalStringArray,
  requireAnswerMode,
  requireChunkingStrategy,
  requireQuery,
} from './validation'

export const answerQuestionFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const data = asObject(input)
    return {
      mode: requireAnswerMode(data.mode),
      strategy: requireChunkingStrategy(data.strategy),
      query: requireQuery(data.query),
      k: optionalK(data.k),
      pipeline: optionalRagPipeline(data.pipeline, 'rag'),
      stitch: optionalBoolean(data.stitch, false),
      expected: optionalStringArray(data.expected),
      expectedSources: optionalStringArray(data.expectedSources),
    }
  })
  .handler(async ({ data }) =>
    answer({
      mode: data.mode,
      strategy: data.strategy,
      query: data.query,
      k: data.k,
      pipeline: data.pipeline,
      stitch: data.stitch,
      expected: data.expected,
      expectedSources: data.expectedSources,
    }),
  )
