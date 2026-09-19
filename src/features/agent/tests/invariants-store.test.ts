import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Store = typeof import('../server/store.server')

let tempDir: string
let store: Store

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-invariants-'))
  const dbPath = join(tempDir, 'test.sqlite')
  process.env.AGENT_DB_PATH = dbPath
  await writeFile(dbPath, '')
  vi.resetModules()
  store = await import('../server/store.server')
})

afterAll(async () => {
  delete process.env.AGENT_DB_PATH
  await rm(tempDir, { recursive: true, force: true })
})

describe('invariant store', () => {
  it('seeds five defaults and keeps custom rules token-scoped', async () => {
    const defaults = await store.listInvariants('tok-manager-demo')
    expect(defaults).toHaveLength(5)
    const created = await store.createInvariant('tok-custom', {
      slug: 'local-rule',
      category: 'business',
      title: 'Локальное правило',
      text: 'Соблюдай правило.',
      check: null,
    })
    expect(await store.getInvariant('other-token', created.id)).toBeNull()
    expect((await store.listInvariants('tok-custom')).map((item) => item.slug)).toContain('local-rule')
  })

  it('does not delete pinned rules and keeps their check immutable', async () => {
    const pinned = (await store.listInvariants('tok-employee-demo')).find((item) => item.slug === 'meeting-end-time')
    expect(pinned).toBeDefined()
    const updated = await store.updateInvariant('tok-employee-demo', pinned!.id, {
      category: 'business',
      title: 'Новое название',
      text: 'Новое описание.',
      check: null,
    })
    expect(updated.check).toBe('meeting-end-time')
    expect(updated.slug).toBe('meeting-end-time')
    expect(await store.deleteInvariant('tok-employee-demo', pinned!.id)).toBe(false)
  })

  it('updates custom content without accepting a slug', async () => {
    const created = await store.createInvariant('tok-update', {
      slug: 'stable-slug',
      category: 'decision',
      title: 'Старое',
      text: 'Старое.',
    })
    const updated = await store.updateInvariant('tok-update', created.id, {
      category: 'decision',
      title: 'Новое',
      text: 'Новое.',
      check: null,
    })
    expect(updated).toMatchObject({ slug: 'stable-slug', title: 'Новое', text: 'Новое.' })
    expect(await store.deleteInvariant('tok-update', created.id)).toBe(true)
  })
})
