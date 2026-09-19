import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InvariantUpdateInput } from '../domain/invariants/types'
import { updateInvariant as updateInvariantFn } from '../functions/update-invariant.functions'
import { invariantsQueryOptions } from './get-invariants'

export function useUpdateInvariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InvariantUpdateInput & { token: string; id: number }) => updateInvariantFn({ data }),
    onSuccess: (_result, vars) => queryClient.invalidateQueries({ queryKey: invariantsQueryOptions(vars.token).queryKey }),
  })
}
