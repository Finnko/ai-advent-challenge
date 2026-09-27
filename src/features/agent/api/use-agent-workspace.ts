import { useCallback, useEffect, useReducer, useRef } from 'react'
import { resolveActiveSessionConfig } from '../domain/session/config'
import type { SessionConfigDraft } from '../domain/session/config'
import {
  canApplyIntent,
  INITIAL_WORKSPACE,
  workspaceReducer,
} from '../domain/workspace'
import type { WorkspaceIntent } from '../domain/workspace'
import { useSessionWorkspace } from './use-session-workspace'
import { useSettingsWorkspace } from './use-settings-workspace'
import { useTaskWorkspace } from './use-task-workspace'

export function useAgentWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, INITIAL_WORKSPACE)
  const busyRef = useRef(false)

  const dispatchIntent = useCallback((intent: WorkspaceIntent) => {
    if (canApplyIntent(intent, busyRef.current)) {
      dispatch(intent)
    }
  }, [])
  const isBusy = useCallback(() => busyRef.current, [])

  const session = useSessionWorkspace({
    state,
    dispatch,
    dispatchIntent,
    isBusy,
  })
  const settings = useSettingsWorkspace({
    state,
    dispatch,
    dispatchIntent,
    isBusy,
    scenario: session.sessionSummary?.scenario ?? null,
  })
  const task = useTaskWorkspace(state.sessionId)

  const busy =
    session.sessionBusy || settings.settingsBusy || session.capabilitiesLoading
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  const active = resolveActiveSessionConfig(
    session.sessionSummary ?? null,
    state.config,
  )

  const actions = {
    ...session.actions,
    ...settings.actions,
    ...task.actions,
    setDraft(draft: string) {
      dispatch({ kind: 'setDraft', draft })
    },
    patchConfig(patch: Partial<SessionConfigDraft>) {
      dispatchIntent({ kind: 'patchConfig', patch })
    },
  }

  return {
    activeToken: state.activeToken,
    sessionId: state.sessionId,
    draft: state.draft,
    config: state.config,
    editingProfileId: state.editingProfileId,
    creatingProfile: state.creatingProfile,
    active,
    people: session.people,
    manager: session.manager,
    employees: session.employees,
    activePerson: session.activePerson,
    sessions: session.sessions,
    sessionSummary: session.sessionSummary,
    facts: session.facts,
    branches: session.branches,
    memoryView: settings.memoryView,
    taskState: task.taskState,
    profiles: settings.profiles,
    invariants: settings.invariants,
    selectedProfile: settings.selectedProfile,
    defaultProfile: settings.defaultProfile,
    messagesData: session.messagesData,
    capabilities: session.capabilities,
    capabilitiesLoading: session.capabilitiesLoading,
    capabilitiesError: session.capabilitiesError,
    orgLoading: session.orgLoading,
    orgError: session.orgError,
    sendError: session.sendError,
    branchError: session.branchError,
    sessionError: session.sessionError,
    settingsError: settings.settingsError,
    taskError: task.taskError,
    busy,
    taskBusy: task.taskBusy,
    sending: session.sending,
    actions,
  }
}

export type AgentWorkspace = ReturnType<typeof useAgentWorkspace>
