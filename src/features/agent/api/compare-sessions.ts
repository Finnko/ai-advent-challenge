import { useMutation } from '@tanstack/react-query'
import { compareSessions as compareSessionsFn } from '../functions/compare-sessions.functions'

export type CompareSessionsInput = {
  token: string
  scenario: string
}

export const compareSessions = (input: CompareSessionsInput) =>
  compareSessionsFn({ data: input })

export function useCompareSessions() {
  return useMutation({
    mutationFn: compareSessions,
  })
}
