import { queryOptions, useQuery } from '@tanstack/react-query'
import { getMemory } from '../functions/get-memory.functions'

export const memoryQueryOptions = (sessionId: number, token: string) =>
  queryOptions({
    queryKey: ['memory', sessionId, token] as const,
    queryFn: () => getMemory({ data: { sessionId, token } }),
    enabled: sessionId > 0 && token.length > 0,
  })

export function useMemory(sessionId: number | null, token: string | null) {
  return useQuery(memoryQueryOptions(sessionId ?? 0, token ?? ''))
}
