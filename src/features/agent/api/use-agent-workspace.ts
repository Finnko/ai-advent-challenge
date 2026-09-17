import { useCallback, useEffect, useReducer } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import type { AgentCapabilities } from '../domain/agent'
import type { MemoryLayer } from '../domain/memory/types'
import type { ProfileInput } from '../domain/profile/types'
import {
  resolveActiveSessionConfig,
  sessionConfigDraftToInput,
} from '../domain/session/config'
import type { SessionConfigDraft } from '../domain/session/config'
import {
  canApplyIntent,
  INITIAL_WORKSPACE,
  workspaceReducer,
} from '../domain/workspace'
import type { WorkspaceIntent } from '../domain/workspace'
import type {
  BranchInfo,
  FactItem,
  MemoryView,
  SessionSummary,
} from '../types'
import { useCapabilities } from './get-capabilities'
import { useOrg } from './get-org'
import { useSessions } from './get-sessions'
import { useSessionMessages } from './get-session-messages'
import { useSessionFacts } from './get-facts'
import { useSessionBranches } from './get-branches'
import { useMemory } from './get-memory'
import { useProfiles } from './get-profiles'
import { useSendMessage } from './send-message'
import { useDeleteSession } from './delete-session'
import { useCreateBranch } from './create-branch'
import { useSwitchBranch } from './switch-branch'
import { useSaveMemory } from './save-memory'
import { useDeleteMemory } from './delete-memory'
import { useCreateProfile } from './create-profile'
import { useUpdateProfile } from './update-profile'
import { useDeleteProfile } from './delete-profile'
import { useSetDefaultProfile } from './set-default-profile'
import {
  useCancelTask,
  usePauseTask,
  useResumeTask,
  useTaskState,
} from './task-state'

const EMPTY_MEMORY: MemoryView = { working: [], longTerm: [] }

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useAgentWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, INITIAL_WORKSPACE)

  const orgQuery = useOrg()
  const people = orgQuery.data ?? []
  const manager = people.find((person) => person.role === 'manager') ?? null
  const employees = people.filter((person) => person.role === 'employee')
  const activePerson =
    people.find((person) => person.token === state.activeToken) ??
    manager ??
    null

  const capabilitiesQuery = useCapabilities(state.activeToken)
  const sessionsQuery = useSessions(state.activeToken)
  const messagesQuery = useSessionMessages(state.sessionId)
  const factsQuery = useSessionFacts(state.sessionId)
  const branchesQuery = useSessionBranches(state.sessionId)
  const memoryQuery = useMemory(state.sessionId, state.activeToken)
  const taskStateQuery = useTaskState(state.sessionId)
  const profilesQuery = useProfiles(state.activeToken)
  const profiles = profilesQuery.data ?? []

  const sendMutation = useSendMessage()
  const deleteMutation = useDeleteSession()
  const branchMutation = useCreateBranch()
  const switchMutation = useSwitchBranch()
  const saveMemoryMutation = useSaveMemory()
  const deleteMemoryMutation = useDeleteMemory()
  const createProfileMutation = useCreateProfile()
  const updateProfileMutation = useUpdateProfile()
  const deleteProfileMutation = useDeleteProfile()
  const setDefaultMutation = useSetDefaultProfile()
  const pauseTaskMutation = usePauseTask()
  const resumeTaskMutation = useResumeTask()
  const cancelTaskMutation = useCancelTask()

  const busy = useIsMutating() > 0 || capabilitiesQuery.isLoading

  const dispatchIntent = useCallback(
    (intent: WorkspaceIntent) => {
      if (canApplyIntent(intent, busy)) {
        dispatch(intent)
      }
    },
    [busy],
  )

  useEffect(() => {
    if (!state.activeToken && manager) {
      dispatch({ kind: 'activateToken', token: manager.token })
    }
  }, [state.activeToken, manager])

  useEffect(() => {
    if (!state.autoPick || !sessionsQuery.isSuccess) {
      return
    }
    const first = sessionsQuery.data[0]
    dispatch({ kind: 'resolveAutoPick', sessionId: first ? first.id : null })
  }, [state.autoPick, sessionsQuery.isSuccess, sessionsQuery.data])

  const sessions: SessionSummary[] = sessionsQuery.data ?? []
  const sessionSummary = sessions.find(
    (session) => session.id === state.sessionId,
  )
  const facts: FactItem[] = factsQuery.data ?? []
  const branches: BranchInfo[] = branchesQuery.data ?? []
  const memoryView = memoryQuery.data ?? EMPTY_MEMORY
  const selectedProfile =
    profiles.find((profile) => profile.id === state.config.profileId) ?? null
  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? null
  const active = resolveActiveSessionConfig(sessionSummary ?? null, state.config)

  const actions = {
    pickPerson(token: string) {
      if (busy || token === state.activeToken) {
        return
      }
      sendMutation.reset()
      dispatchIntent({ kind: 'pickPerson', token })
    },
    openSession(id: number) {
      if (busy || id === state.sessionId) {
        return
      }
      sendMutation.reset()
      dispatchIntent({ kind: 'openSession', sessionId: id })
    },
    newSession() {
      if (busy) {
        return
      }
      sendMutation.reset()
      dispatchIntent({ kind: 'newSession' })
    },
    setDraft(draft: string) {
      dispatch({ kind: 'setDraft', draft })
    },
    patchConfig(patch: Partial<SessionConfigDraft>) {
      dispatchIntent({ kind: 'patchConfig', patch })
    },
    send() {
      const text = state.draft.trim()
      if (text.length === 0 || busy || !state.activeToken) {
        return
      }
      dispatch({ kind: 'setDraft', draft: '' })
      sendMutation.mutate(
        {
          token: state.activeToken,
          sessionId: state.sessionId,
          user: text,
          config: sessionConfigDraftToInput(state.config),
        },
        {
          onSuccess: (result) =>
            dispatch({ kind: 'sendSucceeded', sessionId: result.sessionId }),
        },
      )
    },
    fork(messageId: number) {
      if (busy || state.sessionId === null) {
        return
      }
      branchMutation.mutate({ sessionId: state.sessionId, fromMessageId: messageId })
    },
    switchBranch(branchId: number) {
      if (busy || state.sessionId === null) {
        return
      }
      switchMutation.mutate({ sessionId: state.sessionId, branchId })
    },
    forkCheckpoint(parentBranchId: number, forkMessageId: number) {
      if (busy || state.sessionId === null) {
        return
      }
      branchMutation.mutate({
        sessionId: state.sessionId,
        fromMessageId: forkMessageId,
        parentBranchId,
      })
    },
    deleteSession(id: number) {
      if (busy || !state.activeToken) {
        return
      }
      deleteMutation.mutate(
        { token: state.activeToken, sessionId: id },
        {
          onSuccess: () =>
            dispatch({ kind: 'sessionDeleted', sessionId: id }),
        },
      )
    },
    saveMemory(input: { scope: MemoryLayer; key: string; value: string }) {
      if (!state.activeToken || state.sessionId === null) {
        return
      }
      saveMemoryMutation.mutate({
        ...input,
        token: state.activeToken,
        sessionId: state.sessionId,
        scenario: sessionSummary?.scenario ?? null,
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
      if (busy || !state.activeToken) {
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
    pauseTask() {
      if (busy || state.sessionId === null) {
        return
      }
      pauseTaskMutation.mutate(state.sessionId)
    },
    resumeTask() {
      if (busy || state.sessionId === null) {
        return
      }
      resumeTaskMutation.mutate(state.sessionId)
    },
    cancelTask() {
      if (busy || state.sessionId === null) {
        return
      }
      cancelTaskMutation.mutate(state.sessionId)
    },
  }

  let settingsError: string | null = null
  if (saveMemoryMutation.isError) {
    settingsError = toError(saveMemoryMutation.error)
  } else if (deleteMemoryMutation.isError) {
    settingsError = toError(deleteMemoryMutation.error)
  } else if (createProfileMutation.isError) {
    settingsError = toError(createProfileMutation.error)
  } else if (updateProfileMutation.isError) {
    settingsError = toError(updateProfileMutation.error)
  } else if (deleteProfileMutation.isError) {
    settingsError = toError(deleteProfileMutation.error)
  } else if (setDefaultMutation.isError) {
    settingsError = toError(setDefaultMutation.error)
  }

  let taskError: string | null = null
  if (pauseTaskMutation.isError) {
    taskError = toError(pauseTaskMutation.error)
  } else if (resumeTaskMutation.isError) {
    taskError = toError(resumeTaskMutation.error)
  } else if (cancelTaskMutation.isError) {
    taskError = toError(cancelTaskMutation.error)
  }

  return {
    activeToken: state.activeToken,
    sessionId: state.sessionId,
    draft: state.draft,
    config: state.config,
    editingProfileId: state.editingProfileId,
    creatingProfile: state.creatingProfile,
    active,
    people,
    manager,
    employees,
    activePerson,
    sessions,
    sessionSummary,
    facts,
    branches,
    memoryView,
    taskState: taskStateQuery.data?.taskState ?? null,
    profiles,
    selectedProfile,
    defaultProfile,
    messagesData: messagesQuery.data ?? [],
    capabilities: capabilitiesQuery.data as AgentCapabilities | undefined,
    capabilitiesLoading: capabilitiesQuery.isLoading,
    capabilitiesError: capabilitiesQuery.isError
      ? toError(capabilitiesQuery.error)
      : null,
    orgLoading: orgQuery.isLoading,
    orgError: orgQuery.isError ? toError(orgQuery.error) : null,
    sendError: sendMutation.isError ? toError(sendMutation.error) : null,
    branchError: branchMutation.isError ? toError(branchMutation.error) : null,
    settingsError,
    taskError,
    busy,
    sending: sendMutation.isPending,
    actions,
  }
}

export type AgentWorkspace = ReturnType<typeof useAgentWorkspace>
