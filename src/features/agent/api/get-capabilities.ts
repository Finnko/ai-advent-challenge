import { queryOptions, useQuery } from '@tanstack/react-query'
import { resolveCapabilities } from '../functions/resolve-capabilities.functions'

export const capabilitiesQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['capabilities', token] as const,
    queryFn: () => resolveCapabilities({ data: { token } }),
    enabled: token.length > 0,
  })

export function useCapabilities(token: string | null) {
  return useQuery(capabilitiesQueryOptions(token ?? ''))
}
