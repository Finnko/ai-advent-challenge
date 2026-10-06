import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { runLocalLlm } from '../functions/run.functions'
import { localLlmStatus } from '../functions/status.functions'
import type { LocalLlmInput } from '../types'

export const localLlmStatusQueryOptions = queryOptions({
  queryKey: ['local-llm', 'status'] as const,
  queryFn: () => localLlmStatus(),
  refetchInterval: 15_000,
})

export function useLocalLlmStatus() {
  return useQuery(localLlmStatusQueryOptions)
}

export function useLocalLlmRun() {
  return useMutation({
    mutationFn: (input: LocalLlmInput) => runLocalLlm({ data: input }),
  })
}
