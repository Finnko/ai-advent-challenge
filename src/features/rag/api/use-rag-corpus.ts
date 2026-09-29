import { queryOptions, useQuery } from '@tanstack/react-query'
import { listCorpus } from '../functions/list-corpus.functions'

export const ragCorpusQueryOptions = queryOptions({
  queryKey: ['rag', 'corpus'] as const,
  queryFn: () => listCorpus(),
  staleTime: 5_000,
})

export function useRagCorpus() {
  return useQuery(ragCorpusQueryOptions)
}
