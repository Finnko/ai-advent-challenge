import { useMutation } from '@tanstack/react-query'
import { compareCompression } from '../functions/compare-compression.functions'

export function useCompareCompression() {
  return useMutation({
    mutationFn: (input: { token: string; sessionId: number; user: string }) =>
      compareCompression({ data: input }),
  })
}
