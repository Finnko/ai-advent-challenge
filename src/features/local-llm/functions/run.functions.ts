import { createServerFn } from '@tanstack/react-start'
import { runLocalPrompt } from '../server/local-llm.server'
import { resolveRunPrompt } from './validation'

export const runLocalLlm = createServerFn({ method: 'POST' })
  .validator(resolveRunPrompt)
  .handler(async ({ data: prompt }) => runLocalPrompt(prompt))
