import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSession as deleteSessionFn } from '../functions/delete-session.functions'
import { sessionsQueryOptions } from './get-sessions'

export type DeleteSessionInput = {
  token: string
  sessionId: number
}

export const deleteSession = ({ token: _token, sessionId }: DeleteSessionInput) =>
  deleteSessionFn({ data: { sessionId } })

export function useDeleteSession() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: deleteSession,
  })
}
