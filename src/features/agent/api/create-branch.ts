import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBranch } from '../functions/create-branch.functions'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionMessagesQueryOptions } from './get-session-messages'

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      sessionId: number
      fromMessageId: number
      parentBranchId?: number
      title?: string
    }) => createBranch({ data: input }),
    onSuccess: (result, input) => {
      queryClient.setQueryData(
        sessionBranchesQueryOptions(input.sessionId).queryKey,
        result.branches,
      )
      queryClient.invalidateQueries({
        queryKey: sessionMessagesQueryOptions(input.sessionId).queryKey,
      })
    },
  })
}
