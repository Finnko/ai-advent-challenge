import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { buildAssistantIndex } from '../functions/build-index.functions'
import { getAssistantIndexStats } from '../functions/index-stats.functions'

export const assistantIndexQueryOptions = queryOptions({
  queryKey: ['dev-assistant', 'index'] as const,
  queryFn: () => getAssistantIndexStats(),
  staleTime: 5_000,
})

export function useAssistantIndex() {
  return useQuery(assistantIndexQueryOptions)
}

export function useBuildAssistantIndex() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => buildAssistantIndex(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dev-assistant'] })
    },
  })
}
