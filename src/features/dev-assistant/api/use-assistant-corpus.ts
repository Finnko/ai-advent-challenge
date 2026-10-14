import { queryOptions, useQuery } from '@tanstack/react-query'
import { listAssistantCorpus } from '../functions/corpus.functions'

export const assistantCorpusQueryOptions = queryOptions({
  queryKey: ['dev-assistant', 'corpus'] as const,
  queryFn: () => listAssistantCorpus(),
  staleTime: 5_000,
})

export function useAssistantCorpus() {
  return useQuery(assistantCorpusQueryOptions)
}
