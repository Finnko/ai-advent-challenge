import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemoryLayer } from '../domain/memory/types'
import { saveMemory } from '../functions/save-memory.functions'
import { memoryQueryOptions } from './get-memory'

export type SaveMemoryInput = {
  scope: MemoryLayer
  sessionId: number
  token: string
  key: string
  value: string
  scenario?: string | null
}

export function useSaveMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveMemoryInput) => saveMemory({ data: input }),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: memoryQueryOptions(input.sessionId, input.token).queryKey,
      })
    },
  })
}
