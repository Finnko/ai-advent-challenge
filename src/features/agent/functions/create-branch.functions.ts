import { createServerFn } from '@tanstack/react-start'
import {
  createBranch as createBranchInStore,
  listBranchesDetailed,
} from '../server/store.server'
import { asObject, requireBranchId, requireSessionId } from './validation'

function requireOptionalId(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null
  }
  return requireBranchId(value)
}

export const createBranch = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      sessionId: number
      fromMessageId?: number | null
      parentBranchId?: number | null
      title?: string
    }) => {
      const data = asObject(input)
      return {
        sessionId: requireSessionId(data.sessionId),
        fromMessageId: requireOptionalId(data.fromMessageId),
        parentBranchId: requireOptionalId(data.parentBranchId),
        title:
          typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title.trim()
            : null,
      }
    },
  )
  .handler(async ({ data }) => {
    const existing = await listBranchesDetailed(data.sessionId)
    if (
      data.parentBranchId !== null &&
      !existing.some((branch) => branch.id === data.parentBranchId)
    ) {
      throw new Error('Ветка-родитель не принадлежит сессии')
    }
    const title = data.title ?? `ветка ${existing.length + 1}`
    await createBranchInStore(
      data.sessionId,
      data.fromMessageId,
      title,
      data.parentBranchId,
    )
    const branches = await listBranchesDetailed(data.sessionId)
    return { branches }
  })
