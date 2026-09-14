import { useMutation, useQueryClient } from '@tanstack/react-query'
import { switchBranch } from '../functions/switch-branch.functions'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionMessagesQueryOptions } from './get-session-messages'

export function useSwitchBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sessionId: number; branchId: number }) =>
      switchBranch({ data: input }),
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
