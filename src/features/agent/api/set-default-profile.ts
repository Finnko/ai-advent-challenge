import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setDefaultProfile as setDefaultProfileFn } from '../functions/set-default-profile.functions'
import { profilesQueryOptions } from './get-profiles'

export type SetDefaultProfileInput = {
  token: string
  profileId: number
}

export const setDefaultProfile = (input: SetDefaultProfileInput) =>
  setDefaultProfileFn({ data: input })

export function useSetDefaultProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: profilesQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: setDefaultProfile,
  })
}
