import { useMutation, useQueryClient } from '@tanstack/react-query'
import { switchBranch as switchBranchFn } from '../functions/switch-branch.functions'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionMessagesQueryOptions } from './get-session-messages'

export type SwitchBranchInput = {
  sessionId: number
  branchId: number
}

export const switchBranch = (input: SwitchBranchInput) =>
  switchBranchFn({ data: input })

export function useSwitchBranch() {
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
    mutationFn: switchBranch,
  })
}
