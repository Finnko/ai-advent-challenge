import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Store = typeof import('../server/store.server')

let tempDir: string
let store: Store

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-branch-'))
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

async function seedSession() {
  const sessionId = await store.createSession('tok-test', 'ветки', {
    strategy: 'branch',
  })
  await store.appendMessage(sessionId, 'user', 'u1')
  await store.appendMessage(sessionId, 'assistant', 'a1')
  await store.appendMessage(sessionId, 'user', 'u2')
  await store.appendMessage(sessionId, 'assistant', 'a2')
  const rows = await store.loadMessages(sessionId)
  const [root] = await store.listBranchesDetailed(sessionId)
  return { sessionId, rows, root }
}

describe('branching', () => {
  it('форк от середины копирует историю до checkpoint и активирует ветку', async () => {
    const { sessionId, rows, root } = await seedSession()
    const forkAt = rows[1]

    const childId = await store.createBranch(sessionId, forkAt.id, 'ветка 2')
    const child = (await store.listBranchesDetailed(sessionId)).find(
      (branch) => branch.id === childId,
    )

    expect(child?.parentBranchId).toBe(root.id)
    expect(child?.forkMessageId).toBe(forkAt.id)
    expect(child?.isActive).toBe(true)
    expect((await store.loadMessages(sessionId)).map((m) => m.content)).toEqual([
      'u1',
      'a1',
    ])
  })

  it('два форка одного checkpoint дают сиблингов и независимые истории', async () => {
    const { sessionId, rows, root } = await seedSession()
    const forkAt = rows[1]

    const firstId = await store.createBranch(sessionId, forkAt.id, 'ветка 2')
    await store.appendMessage(sessionId, 'user', 'only-in-first')

    const first = (await store.listBranchesDetailed(sessionId)).find(
      (branch) => branch.id === firstId,
    )
    expect(first).toBeDefined()

    const secondId = await store.createBranch(
      sessionId,
      first!.forkMessageId!,
      'ветка 3',
      first!.parentBranchId!,
    )
    const branches = await store.listBranchesDetailed(sessionId)
    const second = branches.find((branch) => branch.id === secondId)

    expect(second?.parentBranchId).toBe(root.id)
    expect(second?.forkMessageId).toBe(forkAt.id)
    expect((await store.loadMessages(sessionId)).map((m) => m.content)).toEqual([
      'u1',
      'a1',
    ])

    await store.setActiveBranch(sessionId, firstId)
    expect((await store.loadMessages(sessionId)).map((m) => m.content)).toEqual([
      'u1',
      'a1',
      'only-in-first',
    ])
  })

  it('форк сообщения из неактивной ветки крепится к своей ветке', async () => {
    const { sessionId, rows, root } = await seedSession()
    const forkAt = rows[1]

    const firstId = await store.createBranch(sessionId, forkAt.id, 'ветка 2')
    await store.setActiveBranch(sessionId, firstId)

    const crossId = await store.createBranch(sessionId, forkAt.id, 'ветка 3')
    const cross = (await store.listBranchesDetailed(sessionId)).find(
      (branch) => branch.id === crossId,
    )

    expect(cross?.parentBranchId).toBe(root.id)
    expect(cross?.isActive).toBe(true)
  })
})
