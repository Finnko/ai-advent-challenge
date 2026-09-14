import { createServerFn } from '@tanstack/react-start'
import { listBranchesDetailed, setActiveBranch } from '../server/store.server'
import { asObject, requireBranchId, requireSessionId } from './validation'

export const switchBranch = createServerFn({ method: 'POST' })
  .validator((input: { sessionId: number; branchId: number }) => {
    const data = asObject(input)
    return {
      sessionId: requireSessionId(data.sessionId),
      branchId: requireBranchId(data.branchId),
    }
  })
  .handler(async ({ data }) => {
    await setActiveBranch(data.sessionId, data.branchId)
    const branches = await listBranchesDetailed(data.sessionId)
    return { branches }
  })
