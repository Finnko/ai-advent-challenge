import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteInvariant as deleteInvariantFn } from '../functions/delete-invariant.functions'
import { invariantsQueryOptions } from './get-invariants'

export function useDeleteInvariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { token: string; id: number }) => deleteInvariantFn({ data }),
    onSuccess: (_result, vars) => queryClient.invalidateQueries({ queryKey: invariantsQueryOptions(vars.token).queryKey }),
  })
}
