import { DEFAULT_SESSION_CONFIG_DRAFT } from './session/config'
import type { SessionConfigDraft } from './session/config'

export type WorkspaceState = {
  activeToken: string | null
  sessionId: number | null
  draft: string
  config: SessionConfigDraft
  editingProfileId: number | null
  creatingProfile: boolean
  autoPick: boolean
}

export const INITIAL_WORKSPACE: WorkspaceState = {
  activeToken: null,
  sessionId: null,
  draft: '',
  config: DEFAULT_SESSION_CONFIG_DRAFT,
  editingProfileId: null,
  creatingProfile: false,
  autoPick: false,
}

export type WorkspaceIntent =
  | { kind: 'activateToken'; token: string }
  | { kind: 'pickPerson'; token: string }
  | { kind: 'openSession'; sessionId: number }
  | { kind: 'resolveAutoPick'; sessionId: number | null }
  | { kind: 'newSession' }
  | { kind: 'setDraft'; draft: string }
  | { kind: 'patchConfig'; patch: Partial<SessionConfigDraft> }
  | { kind: 'selectProfile'; profileId: number }
  | { kind: 'startCreateProfile' }
  | { kind: 'startEditProfile'; profileId: number }
  | { kind: 'finishProfileEdit' }
  | { kind: 'clearProfile'; profileId: number }
  | { kind: 'profileCreated'; profileId: number }
  | { kind: 'sendSucceeded'; sessionId: number }
  | { kind: 'sessionDeleted'; sessionId: number }

const NAVIGATION_INTENTS: WorkspaceIntent['kind'][] = [
  'pickPerson',
  'openSession',
  'newSession',
]

export function canApplyIntent(
  intent: WorkspaceIntent,
  busy: boolean,
): boolean {
  if (!busy) {
    return true
  }
  return !NAVIGATION_INTENTS.includes(intent.kind)
}

function withSession(
  state: WorkspaceState,
  sessionId: number | null,
): WorkspaceState {
  return {
    ...state,
    sessionId,
    draft: '',
    editingProfileId: null,
    creatingProfile: false,
    autoPick: false,
  }
}

export function workspaceReducer(
  state: WorkspaceState,
  intent: WorkspaceIntent,
): WorkspaceState {
  switch (intent.kind) {
    case 'activateToken':
      return state.activeToken === null
        ? { ...state, activeToken: intent.token }
        : state
    case 'pickPerson':
      if (state.activeToken === intent.token) {
        return state
      }
      return {
        ...state,
        activeToken: intent.token,
        sessionId: null,
        draft: '',
        config: { ...state.config, profileId: null },
        editingProfileId: null,
        creatingProfile: false,
        autoPick: true,
      }
    case 'openSession':
      if (state.sessionId === intent.sessionId) {
        return state
      }
      return withSession(state, intent.sessionId)
    case 'resolveAutoPick':
      if (!state.autoPick) {
        return state
      }
      return intent.sessionId === null
        ? { ...state, autoPick: false }
        : withSession(state, intent.sessionId)
    case 'newSession':
      return { ...withSession(state, null), autoPick: false }
    case 'setDraft':
      return { ...state, draft: intent.draft }
    case 'patchConfig':
      return { ...state, config: { ...state.config, ...intent.patch } }
    case 'selectProfile':
      return {
        ...state,
        editingProfileId: intent.profileId,
        creatingProfile: false,
        config: { ...state.config, profileId: intent.profileId },
      }
    case 'startCreateProfile':
      return { ...state, creatingProfile: true, editingProfileId: null }
    case 'startEditProfile':
      return { ...state, creatingProfile: false, editingProfileId: intent.profileId }
    case 'finishProfileEdit':
      return { ...state, creatingProfile: false, editingProfileId: null }
    case 'clearProfile':
      return {
        ...state,
        config:
          state.config.profileId === intent.profileId
            ? { ...state.config, profileId: null }
            : state.config,
        editingProfileId:
          state.editingProfileId === intent.profileId
            ? null
            : state.editingProfileId,
      }
    case 'profileCreated':
      return {
        ...state,
        creatingProfile: false,
        editingProfileId: intent.profileId,
        config: { ...state.config, profileId: intent.profileId },
      }
    case 'sendSucceeded':
      return { ...state, sessionId: intent.sessionId, autoPick: false }
    case 'sessionDeleted':
      return state.sessionId === intent.sessionId
        ? { ...state, sessionId: null }
        : state
    default:
      return state
  }
}

export function isSessionLocked(state: WorkspaceState): boolean {
  return state.sessionId !== null
}
