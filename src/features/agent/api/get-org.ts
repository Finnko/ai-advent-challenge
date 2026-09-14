import { queryOptions, useQuery } from '@tanstack/react-query'
import { listOrg } from '../functions/list-org.functions'

export const orgQueryOptions = () =>
  queryOptions({
    queryKey: ['org'] as const,
    queryFn: () => listOrg(),
  })

export function useOrg() {
  return useQuery(orgQueryOptions())
}
