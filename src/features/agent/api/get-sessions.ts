import { queryOptions, useQuery } from '@tanstack/react-query'
import { listSessions } from '../functions/list-sessions.functions'

export const sessionsQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['sessions', token] as const,
    queryFn: () => listSessions({ data: { token } }),
    enabled: token.length > 0,
  })

export function useSessions(token: string | null) {
  return useQuery(sessionsQueryOptions(token ?? ''))
}
