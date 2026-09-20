import { queryOptions, useQuery } from '@tanstack/react-query'
import { listInvariants } from '../functions/list-invariants.functions'

export const invariantsQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['invariants', token] as const,
    queryFn: () => listInvariants({ data: { token } }),
    enabled: token.length > 0,
  })

export function useInvariants(token: string | null) {
  return useQuery(invariantsQueryOptions(token ?? ''))
}
