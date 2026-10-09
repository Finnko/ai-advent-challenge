import { queryOptions, useQuery } from '@tanstack/react-query'
import { ragLlmStatusFn } from '../functions/local-status.functions'

export const ragLocalStatusQueryOptions = queryOptions({
  queryKey: ['rag', 'local-status'] as const,
  queryFn: () => ragLlmStatusFn(),
  staleTime: 15_000,
  refetchInterval: 15_000,
})

export function useRagLocalStatus() {
  return useQuery(ragLocalStatusQueryOptions)
}
