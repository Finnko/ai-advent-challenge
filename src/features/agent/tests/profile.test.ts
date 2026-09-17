import { describe, expect, it } from 'vitest'
import { buildProfileBlocks, formatProfileBlock } from '../domain/profile/read'
import type { ProfileRecord } from '../domain/profile/types'

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: 1,
    token: 'tok-a',
    name: 'Формальный',
    addressing: null,
    tone: null,
    language: null,
    verbosity: null,
    format: null,
    constraints: null,
    instructions: null,
    isDefault: true,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('profile block', () => {
  it('рендерит только непустые поля с заголовком', () => {
    const content = formatProfileBlock(
      profile({
        addressing: 'Анна',
        tone: 'деловой',
        verbosity: 'кратко',
      }),
    )
    expect(content).toContain('ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:')
    expect(content).toContain('- Как обращаться: Анна')
    expect(content).toContain('- Тон: деловой')
    expect(content).toContain('- Длина ответов: кратко')
    expect(content).not.toContain('Ограничения')
    expect(content).not.toContain('Инструкции')
  })

  it('выносит свободные инструкции отдельным подблоком', () => {
    const content = formatProfileBlock(
      profile({
        tone: 'дружелюбный',
        instructions: 'Сначала уточни требования, затем предложи план.',
      }),
    )
    expect(content).toContain('Инструкции:\nСначала уточни требования')
  })

  it('без заполненных полей не даёт блока', () => {
    expect(formatProfileBlock(profile())).toBe('')
    expect(buildProfileBlocks(profile())).toEqual([])
    expect(buildProfileBlocks(null)).toEqual([])
  })

  it('buildProfileBlocks отдаёт блок с kind profile', () => {
    const blocks = buildProfileBlocks(profile({ tone: 'деловой' }))
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('profile')
    expect(blocks[0].content).toContain('деловой')
  })
})
