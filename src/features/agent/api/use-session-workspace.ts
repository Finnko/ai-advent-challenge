import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { AgentCapabilities } from '../domain/agent'
import { sessionConfigDraftToInput } from '../domain/session/config'
import type { WorkspaceIntent, WorkspaceState } from '../domain/workspace'
import type { BranchInfo, FactItem, SessionSummary } from '../types'
import { useCapabilities } from './get-capabilities'
import { useOrg } from './get-org'
import { useSessions } from './get-sessions'
import { useSessionMessages } from './get-session-messages'
import { useSessionFacts } from './get-facts'
import { useSessionBranches } from './get-branches'
import { useCreateSession } from './create-session'
import { useSendMessage } from './send-message'
import { useDeleteSession } from './delete-session'
import { useCreateBranch } from './create-branch'
import { useSwitchBranch } from './switch-branch'
import { anyPending, toError } from './workspace-status'

type SessionWorkspaceInput = {
  state: WorkspaceState
  dispatch: Dispatch<WorkspaceIntent>
  dispatchIntent: (intent: WorkspaceIntent) => void
  isBusy: () => boolean
}

export function useSessionWorkspace({
  state,
  dispatch,
  dispatchIntent,
  isBusy,
}: SessionWorkspaceInput) {
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

  const createSessionMutation = useCreateSession()
  const sendMutation = useSendMessage()
  const deleteMutation = useDeleteSession()
  const branchMutation = useCreateBranch()
  const switchMutation = useSwitchBranch()

  const sessionBusy = anyPending([
    createSessionMutation,
    sendMutation,
    deleteMutation,
    branchMutation,
    switchMutation,
  ])

  useEffect(() => {
    if (!state.activeToken && manager) {
      dispatch({ kind: 'activateToken', token: manager.token })
    }
  }, [state.activeToken, manager, dispatch])

  useEffect(() => {
    if (!state.autoPick || !sessionsQuery.isSuccess) {
      return
    }
    const first = sessionsQuery.data[0]
    dispatch({ kind: 'resolveAutoPick', sessionId: first ? first.id : null })
  }, [state.autoPick, sessionsQuery.isSuccess, sessionsQuery.data, dispatch])

  const sessions: SessionSummary[] = sessionsQuery.data ?? []
  const sessionSummary = sessions.find(
    (session) => session.id === state.sessionId,
  )
  const facts: FactItem[] = factsQuery.data ?? []
  const branches: BranchInfo[] = branchesQuery.data ?? []

  const actions = {
    pickPerson(token: string) {
      if (isBusy() || token === state.activeToken) {
        return
      }
      sendMutation.reset()
      dispatchIntent({ kind: 'pickPerson', token })
    },
    openSession(id: number) {
      if (isBusy() || id === state.sessionId) {
        return
      }
      sendMutation.reset()
      dispatchIntent({ kind: 'openSession', sessionId: id })
    },
    newSession() {
      if (isBusy() || !state.activeToken) {
        return
      }
      sendMutation.reset()
      createSessionMutation.mutate(
        {
          token: state.activeToken,
          config: sessionConfigDraftToInput(state.config),
        },
        {
          onSuccess: (result) =>
            dispatch({ kind: 'openSession', sessionId: result.sessionId }),
        },
      )
    },
    send() {
      const text = state.draft.trim()
      if (
        text.length === 0 ||
        isBusy() ||
        !state.activeToken ||
        state.sessionId === null
      ) {
        return
      }
      const sessionId = state.sessionId
      dispatch({ kind: 'setDraft', draft: '' })
      sendMutation.mutate(
        {
          token: state.activeToken,
          sessionId,
          user: text,
        },
        {
          onSuccess: () => dispatch({ kind: 'sendSucceeded', sessionId }),
        },
      )
    },
    fork(messageId: number) {
      if (isBusy() || state.sessionId === null) {
        return
      }
      branchMutation.mutate({
        sessionId: state.sessionId,
        fromMessageId: messageId,
      })
    },
    switchBranch(branchId: number) {
      if (isBusy() || state.sessionId === null) {
        return
      }
      switchMutation.mutate({ sessionId: state.sessionId, branchId })
    },
    forkCheckpoint(parentBranchId: number, forkMessageId: number) {
      if (isBusy() || state.sessionId === null) {
        return
      }
      branchMutation.mutate({
        sessionId: state.sessionId,
        fromMessageId: forkMessageId,
        parentBranchId,
      })
    },
    deleteSession(id: number) {
      if (isBusy() || !state.activeToken) {
        return
      }
      deleteMutation.mutate(
        { token: state.activeToken, sessionId: id },
        {
          onSuccess: () => dispatch({ kind: 'sessionDeleted', sessionId: id }),
        },
      )
    },
  }

  return {
    people,
    manager,
    employees,
    activePerson,
    capabilities: capabilitiesQuery.data as AgentCapabilities | undefined,
    capabilitiesLoading: capabilitiesQuery.isLoading,
    capabilitiesError: capabilitiesQuery.isError
      ? toError(capabilitiesQuery.error)
      : null,
    orgLoading: orgQuery.isLoading,
    orgError: orgQuery.isError ? toError(orgQuery.error) : null,
    sessions,
    sessionSummary,
    facts,
    branches,
    messagesData: messagesQuery.data ?? [],
    sending: sendMutation.isPending,
    sendError: sendMutation.isError ? toError(sendMutation.error) : null,
    branchError: branchMutation.isError ? toError(branchMutation.error) : null,
    sessionError: createSessionMutation.isError
      ? toError(createSessionMutation.error)
      : null,
    sessionBusy,
    actions,
  }
}
