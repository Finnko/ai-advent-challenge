import { queryOptions, useQuery } from '@tanstack/react-query'
import { listBranches } from '../functions/list-branches.functions'

export const sessionBranchesQueryOptions = (sessionId: number) =>
  queryOptions({
    queryKey: ['session-branches', sessionId] as const,
    queryFn: () => listBranches({ data: { sessionId } }),
    enabled: sessionId > 0,
  })

export function useSessionBranches(sessionId: number | null) {
  return useQuery(sessionBranchesQueryOptions(sessionId ?? 0))
}
