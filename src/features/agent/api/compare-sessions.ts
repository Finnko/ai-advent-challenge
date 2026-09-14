import { useMutation } from '@tanstack/react-query'
import { compareSessions } from '../functions/compare-sessions.functions'

export function useCompareSessions() {
  return useMutation({
    mutationFn: (input: { token: string; scenario: string }) =>
      compareSessions({ data: input }),
  })
}
