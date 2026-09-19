import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SessionConfigInput } from '../domain/session/config'
import { createSession } from '../functions/create-session.functions'
import { sessionsQueryOptions } from './get-sessions'

export type CreateSessionInput = {
  token: string
  config: SessionConfigInput
}

export function useCreateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateSessionInput) =>
      createSession({ data: input }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(vars.token).queryKey,
      })
    },
  })
}
