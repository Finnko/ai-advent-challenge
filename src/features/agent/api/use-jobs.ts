import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { listJobs } from '../functions/list-jobs.functions'
import { runJobs } from '../functions/run-jobs.functions'

export const jobsQueryOptions = queryOptions({
  queryKey: ['jobs', 'overview'] as const,
  queryFn: () => listJobs(),
  staleTime: 15_000,
})

export function useJobs() {
  return useQuery(jobsQueryOptions)
}

export function useRunJobs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => runJobs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: ['mcp', 'tools'] })
    },
  })
}
