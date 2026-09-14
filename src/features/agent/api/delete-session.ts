import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSession } from '../functions/delete-session.functions'
import { sessionsQueryOptions } from './get-sessions'

export function useDeleteSession(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: number) =>
      deleteSession({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(token).queryKey,
      })
    },
  })
}
