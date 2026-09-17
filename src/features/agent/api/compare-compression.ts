import { useMutation } from '@tanstack/react-query'
import { compareCompression as compareCompressionFn } from '../functions/compare-compression.functions'

export type CompareCompressionInput = {
  token: string
  sessionId: number
  user: string
}

export const compareCompression = (input: CompareCompressionInput) =>
  compareCompressionFn({ data: input })

export function useCompareCompression() {
  return useMutation({
    mutationFn: compareCompression,
  })
}
