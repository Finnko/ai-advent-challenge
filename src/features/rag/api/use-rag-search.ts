import { useMutation, useQueryClient } from '@tanstack/react-query'
import { searchIndex } from '../functions/search.functions'

export function useRagSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      strategy: 'fixed' | 'structural'
      query: string
      k?: number
      candidateK?: number
      rerank?: boolean
      rewrite?: boolean
      threshold?: number | null
    }) => searchIndex({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag', 'index'] })
    },
  })
}
