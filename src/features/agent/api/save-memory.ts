import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MemoryLayer } from '../domain/memory/types'
import { saveMemory as saveMemoryFn } from '../functions/save-memory.functions'
import { memoryQueryOptions } from './get-memory'

export type SaveMemoryInput = {
  scope: MemoryLayer
  sessionId: number
  token: string
  key: string
  value: string
  scenario?: string | null
}

export const saveMemory = (input: SaveMemoryInput) => saveMemoryFn({ data: input })

export function useSaveMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: memoryQueryOptions(vars.sessionId, vars.token).queryKey,
      })
    },
    mutationFn: saveMemory,
  })
}
