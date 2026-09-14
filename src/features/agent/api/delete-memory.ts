import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemoryLayer } from '../domain/memory/types'
import { deleteMemory } from '../functions/delete-memory.functions'
import { memoryQueryOptions } from './get-memory'

export type DeleteMemoryInput = {
  scope: MemoryLayer
  sessionId: number
  token: string
  key: string
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DeleteMemoryInput) => deleteMemory({ data: input }),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({
        queryKey: memoryQueryOptions(input.sessionId, input.token).queryKey,
      })
    },
  })
}
