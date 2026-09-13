import { queryOptions, useQuery } from '@tanstack/react-query'
import { loadSession } from '../functions/load-session.functions'

export const sessionMessagesQueryOptions = (sessionId: number) =>
  queryOptions({
    queryKey: ['session-messages', sessionId] as const,
    queryFn: () => loadSession({ data: { sessionId } }),
    enabled: sessionId > 0,
  })

export function useSessionMessages(sessionId: number | null) {
  return useQuery(sessionMessagesQueryOptions(sessionId ?? 0))
}
