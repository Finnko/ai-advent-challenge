import type { Dispatch } from 'react'
import type { MemoryLayer } from '../domain/memory/types'
import type {
  InvariantInput,
  InvariantUpdateInput,
} from '../domain/invariants/types'
import type { ProfileInput } from '../domain/profile/types'
import type { WorkspaceIntent, WorkspaceState } from '../domain/workspace'
import type { MemoryView } from '../types'
import { useMemory } from './get-memory'
import { useProfiles } from './get-profiles'
import { useInvariants } from './get-invariants'
import { useSaveMemory } from './save-memory'
import { useDeleteMemory } from './delete-memory'
import { useCreateProfile } from './create-profile'
import { useUpdateProfile } from './update-profile'
import { useDeleteProfile } from './delete-profile'
import { useSetDefaultProfile } from './set-default-profile'
import { useCreateInvariant } from './create-invariant'
import { useUpdateInvariant } from './update-invariant'
import { useDeleteInvariant } from './delete-invariant'
import { anyPending, firstError } from './workspace-status'

const EMPTY_MEMORY: MemoryView = { working: [], longTerm: [] }

type SettingsWorkspaceInput = {
  state: WorkspaceState
  dispatch: Dispatch<WorkspaceIntent>
  dispatchIntent: (intent: WorkspaceIntent) => void
  isBusy: () => boolean
  scenario: string | null
}

export function useSettingsWorkspace({
  state,
  dispatch,
  dispatchIntent,
  isBusy,
  scenario,
}: SettingsWorkspaceInput) {
  const memoryQuery = useMemory(state.sessionId, state.activeToken)
  const profilesQuery = useProfiles(state.activeToken)
  const invariantsQuery = useInvariants(state.activeToken)
  const profiles = profilesQuery.data ?? []

  const saveMemoryMutation = useSaveMemory()
  const deleteMemoryMutation = useDeleteMemory()
  const createProfileMutation = useCreateProfile()
  const updateProfileMutation = useUpdateProfile()
  const deleteProfileMutation = useDeleteProfile()
  const setDefaultMutation = useSetDefaultProfile()
  const createInvariantMutation = useCreateInvariant()
  const updateInvariantMutation = useUpdateInvariant()
  const deleteInvariantMutation = useDeleteInvariant()

  const settingsMutations = [
    saveMemoryMutation,
    deleteMemoryMutation,
    createProfileMutation,
    updateProfileMutation,
    deleteProfileMutation,
    setDefaultMutation,
    createInvariantMutation,
    updateInvariantMutation,
    deleteInvariantMutation,
  ]

  const memoryView = memoryQuery.data ?? EMPTY_MEMORY
  const selectedProfile =
    profiles.find((profile) => profile.id === state.config.profileId) ?? null
  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? null

  const actions = {
    saveMemory(input: { scope: MemoryLayer; key: string; value: string }) {
      if (!state.activeToken || state.sessionId === null) {
        return
      }
      saveMemoryMutation.mutate({
        ...input,
        token: state.activeToken,
        sessionId: state.sessionId,
        scenario,
      })
    },
    forgetMemory(scope: MemoryLayer, key: string) {
      if (!state.activeToken || state.sessionId === null) {
        return
      }
      deleteMemoryMutation.mutate({
        scope,
        key,
        token: state.activeToken,
        sessionId: state.sessionId,
      })
    },
    selectProfile(id: number) {
      dispatchIntent({ kind: 'selectProfile', profileId: id })
    },
    startCreateProfile() {
      dispatchIntent({ kind: 'startCreateProfile' })
    },
    startEditProfile(id: number) {
      dispatchIntent({ kind: 'startEditProfile', profileId: id })
    },
    finishProfileEdit() {
      dispatch({ kind: 'finishProfileEdit' })
    },
    saveProfile(input: ProfileInput) {
      if (!state.activeToken) {
        return
      }
      if (state.creatingProfile) {
        createProfileMutation.mutate(
          {
            token: state.activeToken,
            ...input,
            isDefault: profiles.length === 0,
          },
          {
            onSuccess: (profile) =>
              dispatch({ kind: 'profileCreated', profileId: profile.id }),
          },
        )
        return
      }
      if (state.editingProfileId === null) {
        return
      }
      updateProfileMutation.mutate({
        token: state.activeToken,
        profileId: state.editingProfileId,
        ...input,
      })
    },
    deleteProfile(id: number) {
      if (isBusy() || !state.activeToken) {
        return
      }
      deleteProfileMutation.mutate(
        { token: state.activeToken, profileId: id },
        {
          onSuccess: () => dispatch({ kind: 'clearProfile', profileId: id }),
        },
      )
    },
    setDefaultProfile(id: number) {
      if (!state.activeToken) {
        return
      }
      setDefaultMutation.mutate({ token: state.activeToken, profileId: id })
    },
    createInvariant(input: InvariantInput) {
      if (!state.activeToken) {
        return
      }
      createInvariantMutation.mutate({ token: state.activeToken, ...input })
    },
    updateInvariant(id: number, input: InvariantUpdateInput) {
      if (!state.activeToken) {
        return
      }
      updateInvariantMutation.mutate({ token: state.activeToken, id, ...input })
    },
    deleteInvariant(id: number) {
      if (!state.activeToken) {
        return
      }
      deleteInvariantMutation.mutate({ token: state.activeToken, id })
    },
  }

  return {
    profiles,
    invariants: invariantsQuery.data ?? [],
    memoryView,
    selectedProfile,
    defaultProfile,
    settingsBusy: anyPending(settingsMutations),
    settingsError: firstError(settingsMutations),
    actions,
  }
}
