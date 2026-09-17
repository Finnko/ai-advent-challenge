import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteProfile as deleteProfileFn } from '../functions/delete-profile.functions'
import { profilesQueryOptions } from './get-profiles'
import { sessionsQueryOptions } from './get-sessions'

export type DeleteProfileInput = {
  token: string
  profileId: number
}

export const deleteProfile = ({ token: _token, profileId }: DeleteProfileInput) =>
  deleteProfileFn({ data: { profileId } })

export function useDeleteProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: profilesQueryOptions(vars.token).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(vars.token).queryKey,
      })
    },
    mutationFn: deleteProfile,
  })
}
