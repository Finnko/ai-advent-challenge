import { queryOptions, useQuery } from '@tanstack/react-query'
import { getFacts } from '../functions/get-facts.functions'

export const sessionFactsQueryOptions = (sessionId: number) =>
  queryOptions({
    queryKey: ['session-facts', sessionId] as const,
    queryFn: () => getFacts({ data: { sessionId } }),
    enabled: sessionId > 0,
  })

export function useSessionFacts(sessionId: number | null) {
  return useQuery(sessionFactsQueryOptions(sessionId ?? 0))
}
