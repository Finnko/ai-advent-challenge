import { createServerFn } from '@tanstack/react-start'
import { listBranchesDetailed } from '../server/store.server'
import { asObject, requireSessionId } from './validation'

export const listBranches = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number }) => ({
    sessionId: requireSessionId(asObject(input).sessionId),
  }))
  .handler(async ({ data }) => listBranchesDetailed(data.sessionId))
