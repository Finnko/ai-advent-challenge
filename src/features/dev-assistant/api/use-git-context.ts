import { queryOptions, useQuery } from '@tanstack/react-query'
import { getGitContext } from '../functions/git-context.functions'

export const gitContextQueryOptions = queryOptions({
  queryKey: ['dev-assistant', 'git'] as const,
  queryFn: () => getGitContext(),
  staleTime: 5_000,
})

export function useGitContext() {
  return useQuery(gitContextQueryOptions)
}
