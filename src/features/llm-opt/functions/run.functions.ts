import { createServerFn } from '@tanstack/react-start'
import { resolveConfig } from '../data/configs'
import { runExtraction } from '../server/run.server'
import { upsertRun } from '../server/results.server'
import { resolveRunExtractionInput } from './validation'

export const runExtractionFn = createServerFn({ method: 'POST' })
  .validator(resolveRunExtractionInput)
  .handler(async ({ data }) => {
    const config = resolveConfig(data.configId)
    const run = await runExtraction(config, data.docId, data.repeat)
    upsertRun(run)
    return run
  })
