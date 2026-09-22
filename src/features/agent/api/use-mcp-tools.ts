import { queryOptions, useQuery } from '@tanstack/react-query'
import { listMcpTools } from '../functions/list-mcp-tools.functions'

export const mcpToolsQueryOptions = queryOptions({
  queryKey: ['mcp', 'tools'] as const,
  queryFn: () => listMcpTools(),
  staleTime: 30_000,
})

export function useMcpTools() {
  return useQuery(mcpToolsQueryOptions)
}
