import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBranch as createBranchFn } from '../functions/create-branch.functions'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionMessagesQueryOptions } from './get-session-messages'

export type CreateBranchInput = {
  sessionId: number
  fromMessageId: number
  parentBranchId?: number
  title?: string
}

export const createBranch = (input: CreateBranchInput) =>
  createBranchFn({ data: input })

export function useCreateBranch() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (result, vars) => {
      queryClient.setQueryData(
        sessionBranchesQueryOptions(vars.sessionId).queryKey,
        result.branches,
      )
      queryClient.invalidateQueries({
        queryKey: sessionMessagesQueryOptions(vars.sessionId).queryKey,
      })
    },
    mutationFn: createBranch,
  })
}
