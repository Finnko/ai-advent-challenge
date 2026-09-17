import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_CONFIG_DRAFT,
  clampWindowSize,
  resolveActiveSessionConfig,
  resolveSessionConfig,
  sessionConfigDraftToInput,
  sessionConfigInput,
} from '../domain/session/config'
import { parseSessionConfigInput } from '../functions/validation'

describe('session config', () => {
  it('defaulting собирается в одном месте', () => {
    expect(sessionConfigInput()).toEqual({
      strategy: 'summary',
      scenario: null,
      windowSize: 10,
      memoryEnabled: false,
      profileId: undefined,
      taskStateEnabled: true,
      invariantSetId: undefined,
    })
    expect(DEFAULT_SESSION_CONFIG_DRAFT).toEqual({
      strategy: 'window',
      windowSize: 10,
      memoryEnabled: true,
      profileId: null,
      taskStateEnabled: true,
    })
  })

  it('resolveSessionConfig подставляет дефолтный профиль', () => {
    const fallback = resolveSessionConfig(sessionConfigInput(), 42)
    expect(fallback.profileId).toBe(42)

    const explicit = resolveSessionConfig(
      sessionConfigInput({ profileId: 7 }),
      42,
    )
    expect(explicit.profileId).toBe(7)
  })

  it('драфт превращается во вход создания без явного профиля', () => {
    expect(
      sessionConfigDraftToInput({
        strategy: 'facts',
        windowSize: 4,
        memoryEnabled: true,
        profileId: null,
        taskStateEnabled: false,
      }),
    ).toEqual({
      strategy: 'facts',
      scenario: null,
      windowSize: 4,
      memoryEnabled: true,
      profileId: undefined,
      taskStateEnabled: false,
      invariantSetId: undefined,
    })
  })

  it('активный конфиг неизменен при наличии сессии', () => {
    const session = resolveSessionConfig(
      sessionConfigInput({ strategy: 'branch', profileId: 5 }),
      42,
    )
    const draft = { ...DEFAULT_SESSION_CONFIG_DRAFT, strategy: 'window' as const }
    expect(resolveActiveSessionConfig(session, draft)).toEqual({
      strategy: 'branch',
      windowSize: 10,
      memoryEnabled: false,
      profileId: 5,
      taskStateEnabled: true,
    })
    expect(resolveActiveSessionConfig(null, draft)).toEqual({
      strategy: 'window',
      windowSize: 10,
      memoryEnabled: true,
      profileId: null,
      taskStateEnabled: true,
    })
  })

  it('размер окна ограничивается диапазоном', () => {
    expect(clampWindowSize(1)).toBe(2)
    expect(clampWindowSize(999)).toBe(50)
    expect(clampWindowSize(Number.NaN)).toBe(10)
    expect(clampWindowSize(7.6)).toBe(8)
  })

  it('parseSessionConfigInput валидирует и дефолтит wire-вход', () => {
    expect(parseSessionConfigInput({ strategy: 'summary' })).toEqual({
      strategy: 'summary',
      scenario: null,
      windowSize: 10,
      memoryEnabled: false,
      profileId: undefined,
      taskStateEnabled: true,
      invariantSetId: undefined,
    })

    expect(
      parseSessionConfigInput({
        strategy: 'window',
        windowSize: 3,
        memoryEnabled: true,
        profileId: 9,
      }),
    ).toMatchObject({
      strategy: 'window',
      windowSize: 3,
      memoryEnabled: true,
      profileId: 9,
    })

    expect(() => parseSessionConfigInput({})).toThrow(
      'Неизвестная стратегия контекста',
    )
    expect(() => parseSessionConfigInput({ strategy: 'unknown' })).toThrow(
      'Неизвестная стратегия контекста',
    )
  })
})
