import { useMutation } from '@tanstack/react-query'
import { compareProfiles as compareProfilesFn } from '../functions/compare-profiles.functions'

export type CompareProfilesInput = {
  token: string
  profileIds: number[]
  user: string
}

export const compareProfiles = (input: CompareProfilesInput) =>
  compareProfilesFn({ data: input })

export function useCompareProfiles() {
  return useMutation({
    mutationFn: compareProfiles,
  })
}
