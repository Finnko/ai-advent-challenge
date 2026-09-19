import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InvariantInput } from '../domain/invariants/types'
import { createInvariant as createInvariantFn } from '../functions/create-invariant.functions'
import { invariantsQueryOptions } from './get-invariants'

export function useCreateInvariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InvariantInput & { token: string }) => createInvariantFn({ data }),
    onSuccess: (_result, vars) => queryClient.invalidateQueries({ queryKey: invariantsQueryOptions(vars.token).queryKey }),
  })
}
