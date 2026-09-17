import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProfileInput } from '../domain/profile/types'
import { updateProfile as updateProfileFn } from '../functions/update-profile.functions'
import { profilesQueryOptions } from './get-profiles'

export type UpdateProfileInput = ProfileInput & {
  token: string
  profileId: number
}

export const updateProfile = ({ token: _token, ...data }: UpdateProfileInput) =>
  updateProfileFn({ data })

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: profilesQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: updateProfile,
  })
}
