import { describe, expect, it } from 'vitest'
import {
  INITIAL_WORKSPACE,
  canApplyIntent,
  isSessionLocked,
  workspaceReducer,
} from '../domain/workspace'
import type {
  WorkspaceIntent,
  WorkspaceState,
} from '../domain/workspace'

function apply(
  state: WorkspaceState,
  ...intents: WorkspaceIntent[]
): WorkspaceState {
  return intents.reduce(workspaceReducer, state)
}

describe('workspace reducer', () => {
  it('активирует токен только пока он не выбран', () => {
    const activated = workspaceReducer(INITIAL_WORKSPACE, {
      kind: 'activateToken',
      token: 'manager',
    })
    expect(activated.activeToken).toBe('manager')

    const again = workspaceReducer(activated, {
      kind: 'activateToken',
      token: 'other',
    })
    expect(again.activeToken).toBe('manager')
  })

  it('смена персоны сбрасывает сессию, драфт, профиль и включает авто-выбор', () => {
    const opened = apply(INITIAL_WORKSPACE, {
      kind: 'activateToken',
      token: 'manager',
    })
    const state = apply(
      opened,
      { kind: 'openSession', sessionId: 5 },
      { kind: 'patchConfig', patch: { profileId: 3, memoryEnabled: false } },
      { kind: 'pickPerson', token: 'employee' },
    )

    expect(state.activeToken).toBe('employee')
    expect(state.sessionId).toBeNull()
    expect(state.draft).toBe('')
    expect(state.config.profileId).toBeNull()
    expect(state.config.memoryEnabled).toBe(false)
    expect(state.autoPick).toBe(true)
  })

  it('повторный выбор той же персоны не меняет состояние', () => {
    const state = apply(INITIAL_WORKSPACE, {
      kind: 'activateToken',
      token: 'manager',
    })
    expect(workspaceReducer(state, { kind: 'pickPerson', token: 'manager' })).toBe(
      state,
    )
  })

  it('открытие сессии очищает редактор и авто-выбор', () => {
    const state = apply(
      workspaceReducer(INITIAL_WORKSPACE, {
        kind: 'pickPerson',
        token: 'manager',
      }),
      { kind: 'setDraft', draft: 'текст' },
      { kind: 'startCreateProfile' },
      { kind: 'openSession', sessionId: 9 },
    )

    expect(state.sessionId).toBe(9)
    expect(state.draft).toBe('')
    expect(state.creatingProfile).toBe(false)
    expect(state.editingProfileId).toBeNull()
    expect(state.autoPick).toBe(false)
    expect(isSessionLocked(state)).toBe(true)
  })

  it('разрешение авто-выбора открывает первую сессию или просто гасит флаг', () => {
    const pending = workspaceReducer(INITIAL_WORKSPACE, {
      kind: 'pickPerson',
      token: 'manager',
    })

    const opened = workspaceReducer(pending, {
      kind: 'resolveAutoPick',
      sessionId: 2,
    })
    expect(opened.sessionId).toBe(2)
    expect(opened.autoPick).toBe(false)

    const empty = workspaceReducer(pending, {
      kind: 'resolveAutoPick',
      sessionId: null,
    })
    expect(empty.sessionId).toBeNull()
    expect(empty.autoPick).toBe(false)
  })

  it('новая сессия сбрасывает сессию, но сохраняет конфиг', () => {
    const state = apply(
      INITIAL_WORKSPACE,
      { kind: 'openSession', sessionId: 4 },
      { kind: 'patchConfig', patch: { strategy: 'facts', windowSize: 4 } },
      { kind: 'newSession' },
    )

    expect(state.sessionId).toBeNull()
    expect(state.config.strategy).toBe('facts')
    expect(state.config.windowSize).toBe(4)
  })

  it('ведёт жизненный цикл профиля', () => {
    const created = apply(
      INITIAL_WORKSPACE,
      { kind: 'startCreateProfile' },
      { kind: 'profileCreated', profileId: 7 },
    )
    expect(created.creatingProfile).toBe(false)
    expect(created.editingProfileId).toBe(7)
    expect(created.config.profileId).toBe(7)

    const selected = workspaceReducer(created, {
      kind: 'selectProfile',
      profileId: 8,
    })
    expect(selected.config.profileId).toBe(8)

    const cleared = workspaceReducer(selected, {
      kind: 'clearProfile',
      profileId: 8,
    })
    expect(cleared.config.profileId).toBeNull()
    expect(cleared.editingProfileId).toBeNull()

    const cancelled = workspaceReducer(
      workspaceReducer(cleared, { kind: 'startEditProfile', profileId: 9 }),
      { kind: 'finishProfileEdit' },
    )
    expect(cancelled.creatingProfile).toBe(false)
    expect(cancelled.editingProfileId).toBeNull()
    expect(cancelled.config.profileId).toBeNull()
  })

  it('фиксирует и удаляет сессию по результату мутации', () => {
    const sent = workspaceReducer(INITIAL_WORKSPACE, {
      kind: 'sendSucceeded',
      sessionId: 3,
    })
    expect(sent.sessionId).toBe(3)

    expect(
      workspaceReducer(sent, { kind: 'sessionDeleted', sessionId: 3 }).sessionId,
    ).toBeNull()
    expect(
      workspaceReducer(sent, { kind: 'sessionDeleted', sessionId: 99 }).sessionId,
    ).toBe(3)
  })
})

describe('canApplyIntent', () => {
  it('блокирует навигацию при busy, но пропускает правки', () => {
    expect(canApplyIntent({ kind: 'pickPerson', token: 'x' }, true)).toBe(false)
    expect(canApplyIntent({ kind: 'openSession', sessionId: 1 }, true)).toBe(false)
    expect(canApplyIntent({ kind: 'newSession' }, true)).toBe(false)
    expect(canApplyIntent({ kind: 'setDraft', draft: 'x' }, true)).toBe(true)
    expect(canApplyIntent({ kind: 'patchConfig', patch: {} }, true)).toBe(true)
    expect(canApplyIntent({ kind: 'openSession', sessionId: 1 }, false)).toBe(
      true,
    )
  })
})
