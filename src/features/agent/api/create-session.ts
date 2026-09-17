import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSession as createSessionFn } from '../functions/create-session.functions'
import { sessionsQueryOptions } from './get-sessions'

export type CreateSessionInput = {
  token: string
  strategy: string
  scenario: string | null
}

export const createSession = (input: CreateSessionInput) =>
  createSessionFn({ data: input })

export function useCreateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: createSession,
  })
}
