import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProfileInput } from '../domain/profile/types'
import { createProfile as createProfileFn } from '../functions/create-profile.functions'
import { profilesQueryOptions } from './get-profiles'

export type CreateProfileInput = ProfileInput & {
  token: string
  isDefault?: boolean
}

export const createProfile = (input: CreateProfileInput) =>
  createProfileFn({ data: input })

export function useCreateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_profile, vars) => {
      queryClient.invalidateQueries({
        queryKey: profilesQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: createProfile,
  })
}
