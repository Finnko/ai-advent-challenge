import { queryOptions, useQuery } from '@tanstack/react-query'
import { getComparisonFn } from '../functions/get-comparison.functions'

export const ragComparisonQueryOptions = queryOptions({
  queryKey: ['rag', 'comparison'] as const,
  queryFn: () => getComparisonFn(),
  staleTime: 5_000,
})

export function useRagComparison() {
  return useQuery(ragComparisonQueryOptions)
}
