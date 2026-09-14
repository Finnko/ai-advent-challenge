import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSession } from '../functions/create-session.functions'
import { sessionsQueryOptions } from './get-sessions'

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      token: string
      strategy: string
      scenario: string | null
    }) => createSession({ data: input }),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(input.token).queryKey,
      })
    },
  })
}
