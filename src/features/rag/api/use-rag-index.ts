import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { buildIndex } from '../functions/build-index.functions'
import { getIndexStatsFn } from '../functions/get-index-stats.functions'

export const ragIndexQueryOptions = queryOptions({
  queryKey: ['rag', 'index'] as const,
  queryFn: () => getIndexStatsFn(),
  staleTime: 5_000,
})

export function useRagIndex() {
  return useQuery(ragIndexQueryOptions)
}

export function useBuildIndex() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (strategy: 'fixed' | 'structural' | 'all') =>
      buildIndex({ data: { strategy } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rag'] })
    },
  })
}
