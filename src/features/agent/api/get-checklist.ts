import { queryOptions, useQuery } from '@tanstack/react-query'
import { getChecklist } from '../functions/get-checklist.functions'

export const checklistQueryOptions = (token: string, scenario: string) =>
  queryOptions({
    queryKey: ['scenario-checklist', token, scenario] as const,
    queryFn: () => getChecklist({ data: { token, scenario } }),
    enabled: token.length > 0 && scenario.trim().length > 0,
  })

export function useChecklist(token: string | null, scenario: string) {
  return useQuery(checklistQueryOptions(token ?? '', scenario))
}
