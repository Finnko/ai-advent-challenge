import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemoryLayer } from '../domain/memory/types'
import { deleteMemory as deleteMemoryFn } from '../functions/delete-memory.functions'
import { memoryQueryOptions } from './get-memory'

export type DeleteMemoryInput = {
  scope: MemoryLayer
  sessionId: number
  token: string
  key: string
}

export const deleteMemory = (input: DeleteMemoryInput) =>
  deleteMemoryFn({ data: input })

export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: memoryQueryOptions(vars.sessionId, vars.token).queryKey,
      })
    },
    mutationFn: deleteMemory,
  })
}
