import { queryOptions, useQuery } from '@tanstack/react-query'
import { getComparisonFn } from '../functions/get-comparison.functions'

export function ragComparisonQueryOptions(includeRewrite: boolean) {
  return queryOptions({
    queryKey: ['rag', 'comparison', includeRewrite] as const,
    queryFn: () => getComparisonFn({ data: { includeRewrite } }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRagComparison(includeRewrite = false) {
  return useQuery(ragComparisonQueryOptions(includeRewrite))
}
