import { createServerFn } from '@tanstack/react-start'
import { asObject } from '@lib/functions/validation'
import { getComparison } from '../server/rag.server'
import { optionalBoolean } from './validation'

export const getComparisonFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const data = asObject(input ?? {})
    return { includeRewrite: optionalBoolean(data.includeRewrite, false) }
  })
  .handler(async ({ data }) =>
    getComparison({ includeRewrite: data.includeRewrite }),
  )
