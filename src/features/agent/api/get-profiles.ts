import { queryOptions, useQuery } from '@tanstack/react-query'
import { listProfiles } from '../functions/list-profiles.functions'

export const profilesQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['profiles', token] as const,
    queryFn: () => listProfiles({ data: { token } }),
    enabled: token.length > 0,
  })

export function useProfiles(token: string | null) {
  return useQuery(profilesQueryOptions(token ?? ''))
}
