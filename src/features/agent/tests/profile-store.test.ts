import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Store = typeof import('../server/store.server')

let tempDir: string
let store: Store

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-profile-'))
  const dbPath = join(tempDir, 'test.sqlite')
  await writeFile(dbPath, '')
  process.env.AGENT_DB_PATH = dbPath
  vi.resetModules()
  store = await import('../server/store.server')
})

afterAll(async () => {
  delete process.env.AGENT_DB_PATH
  await rm(tempDir, { recursive: true, force: true })
})

describe('profile store', () => {
  it('первый профиль становится дефолтным', async () => {
    const first = await store.createProfile('tok-profile', {
      name: 'Первый',
      tone: 'деловой',
    })
    expect(first.isDefault).toBe(true)

    const second = await store.createProfile('tok-profile', { name: 'Второй' })
    expect(second.isDefault).toBe(false)
  })

  it('createSession берёт дефолт, явный id или пусто', async () => {
    const token = `tok-bind-${Date.now()}`
    const defaultProfile = await store.createProfile(token, { name: 'Дефолт' })
    const other = await store.createProfile(token, { name: 'Другой' })

    const auto = await store.createSession(token, 'авто')
    expect((await store.getSession(auto))?.profileId).toBe(defaultProfile.id)

    const explicit = await store.createSession(token, 'явно', {
      profileId: other.id,
    })
    expect((await store.getSession(explicit))?.profileId).toBe(other.id)

    const none = await store.createSession(token, 'без профиля', {
      profileId: null,
    })
    expect((await store.getSession(none))?.profileId).toBeNull()
  })

  it('обновляет поля профиля', async () => {
    const created = await store.createProfile('tok-update', { name: 'Старый' })
    const updated = await store.updateProfile(created.id, {
      name: 'Новый',
      addressing: 'Анна',
      instructions: 'План из трёх шагов',
    })
    expect(updated).toMatchObject({
      name: 'Новый',
      addressing: 'Анна',
      instructions: 'План из трёх шагов',
    })
  })

  it('переносит флаг default', async () => {
    const token = 'tok-default'
    const first = await store.createProfile(token, { name: 'A' })
    const second = await store.createProfile(token, { name: 'B' })

    await store.setDefaultProfile(token, second.id)
    const profiles = await store.listProfiles(token)
    expect(profiles.find((p) => p.id === first.id)?.isDefault).toBe(false)
    expect(profiles.find((p) => p.id === second.id)?.isDefault).toBe(true)
  })

  it('удаление обнуляет profile_id и переносит дефолт', async () => {
    const token = 'tok-delete'
    const first = await store.createProfile(token, { name: 'A' })
    const second = await store.createProfile(token, { name: 'B' })
    const sessionId = await store.createSession(token, 's', {
      profileId: first.id,
    })

    await store.deleteProfile(first.id)

    expect((await store.getSession(sessionId))?.profileId).toBeNull()
    expect(await store.getProfile(first.id)).toBeNull()
    const remaining = await store.listProfiles(token)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
    expect(remaining[0].isDefault).toBe(true)
  })

  it('listSessions отдаёт имя профиля сессии', async () => {
    const token = `tok-name-${Date.now()}`
    const profile = await store.createProfile(token, { name: 'Наставник' })
    await store.createSession(token, 'с профилем', { profileId: profile.id })
    const sessions = await store.listSessions(token)
    expect(sessions[0].profileName).toBe('Наставник')
  })
})
