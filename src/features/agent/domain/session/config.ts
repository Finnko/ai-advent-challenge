import type { ContextStrategyId } from '../context/types'
import { WINDOW_SIZE } from '../context/window'

export const WINDOW_SIZE_MIN = 2
export const WINDOW_SIZE_MAX = 50
export const DEFAULT_WINDOW_SIZE = WINDOW_SIZE

export type SessionConfig = {
  strategy: ContextStrategyId
  scenario: string | null
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null
  taskStateEnabled: boolean
  invariantSetId: number | null
}

export type SessionConfigInput = {
  strategy: ContextStrategyId
  scenario: string | null
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null | undefined
  taskStateEnabled: boolean
  invariantSetId: number | null | undefined
}

export type SessionConfigDraft = {
  strategy: ContextStrategyId
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null
  taskStateEnabled: boolean
}

export type ResolvedSessionConfig = {
  strategy: ContextStrategyId
  windowSize: number
  memoryEnabled: boolean
  profileId: number | null
  taskStateEnabled: boolean
}

export const DEFAULT_SESSION_CONFIG_DRAFT: SessionConfigDraft = {
  strategy: 'window',
  windowSize: DEFAULT_WINDOW_SIZE,
  memoryEnabled: true,
  profileId: null,
  taskStateEnabled: true,
}

export function sessionConfigInput(
  overrides: Partial<SessionConfigInput> = {},
): SessionConfigInput {
  return {
    strategy: 'summary',
    scenario: null,
    windowSize: DEFAULT_WINDOW_SIZE,
    memoryEnabled: false,
    profileId: undefined,
    taskStateEnabled: true,
    invariantSetId: undefined,
    ...overrides,
  }
}

export function resolveSessionConfig(
  input: SessionConfigInput,
  defaultProfileId: number | null = null,
): SessionConfig {
  return {
    strategy: input.strategy,
    scenario: input.scenario,
    windowSize: input.windowSize,
    memoryEnabled: input.memoryEnabled,
    profileId:
      input.profileId === undefined ? defaultProfileId : input.profileId,
    taskStateEnabled: input.taskStateEnabled,
    invariantSetId: input.invariantSetId ?? null,
  }
}

export function sessionConfigDraftToInput(
  draft: SessionConfigDraft,
): SessionConfigInput {
  return sessionConfigInput({
    strategy: draft.strategy,
    windowSize: draft.windowSize,
    memoryEnabled: draft.memoryEnabled,
    profileId: draft.profileId ?? undefined,
    taskStateEnabled: draft.taskStateEnabled,
  })
}

export function resolveActiveSessionConfig(
  session: SessionConfig | null,
  draft: SessionConfigDraft,
): ResolvedSessionConfig {
  if (session) {
    return {
      strategy: session.strategy,
      windowSize: session.windowSize,
      memoryEnabled: session.memoryEnabled,
      profileId: session.profileId,
      taskStateEnabled: session.taskStateEnabled,
    }
  }
  return {
    strategy: draft.strategy,
    windowSize: draft.windowSize,
    memoryEnabled: draft.memoryEnabled,
    profileId: draft.profileId,
    taskStateEnabled: draft.taskStateEnabled,
  }
}

export function clampWindowSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WINDOW_SIZE
  }
  return Math.min(
    WINDOW_SIZE_MAX,
    Math.max(WINDOW_SIZE_MIN, Math.round(value)),
  )
}
