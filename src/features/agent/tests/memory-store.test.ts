import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { MemoryEntry } from '../domain/memory/types'

type Store = typeof import('../server/store.server')

let tempDir: string
let store: Store

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-memory-'))
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

function memory(
  layer: MemoryEntry['layer'],
  key: string,
  value: string,
  source: MemoryEntry['source'] = 'auto',
): MemoryEntry {
  return {
    layer,
    key,
    value,
    source,
    updatedAt: new Date().toISOString(),
  }
}

describe('memory store', () => {
  it('фиксирует флаг memory за сессией', async () => {
    const withMemory = await store.createSession('tok-a', 'с памятью', {
      memory: true,
    })
    const without = await store.createSession('tok-a', 'без памяти')

    expect((await store.getSession(withMemory))?.memoryEnabled).toBe(true)
    expect((await store.getSession(without))?.memoryEnabled).toBe(false)
  })

  it('хранит рабочую память отдельно по сессиям', async () => {
    const sessionA = await store.createSession('tok-a', 'A', { memory: true })
    const sessionB = await store.createSession('tok-a', 'B', { memory: true })

    await store.saveWorkingMemory(sessionA, [
      memory('working', 'Цель', 'запуск'),
    ])

    const a = await store.getWorkingMemory(sessionA)
    const b = await store.getWorkingMemory(sessionB)
    expect(a.map((entry) => entry.key)).toEqual(['Цель'])
    expect(b).toEqual([])
  })

  it('долговременная память переживает новые сессии того же токена', async () => {
    const first = await store.createSession('tok-persist', 'первая', {
      memory: true,
    })
    await store.saveLongTermMemory('tok-persist', [
      memory('long-term', 'Роль', 'отвечает за кофе', 'manual'),
    ])
    expect(await store.getWorkingMemory(first)).toEqual([])

    const second = await store.createSession('tok-persist', 'вторая', {
      memory: true,
    })
    const longTerm = await store.getLongTermMemory('tok-persist')
    expect(second).not.toBe(first)
    expect(longTerm).toHaveLength(1)
    expect(longTerm[0]).toMatchObject({
      key: 'Роль',
      value: 'отвечает за кофе',
      source: 'manual',
    })
    expect(await store.getWorkingMemory(second)).toEqual([])
  })

  it('долговременная память изолирована по токену', async () => {
    await store.saveLongTermMemory('tok-x', [memory('long-term', 'kx', 'vx')])
    expect(await store.getLongTermMemory('tok-y')).toEqual([])
  })

  it('удаляет запись из нужного слоя', async () => {
    const sessionId = await store.createSession('tok-del', 'del', {
      memory: true,
    })
    await store.saveWorkingMemory(sessionId, [
      memory('working', 'A', '1'),
      memory('working', 'B', '2'),
    ])
    await store.saveLongTermMemory('tok-del', [
      memory('long-term', 'A', '1'),
    ])

    await store.deleteMemoryEntry({ sessionId }, 'working', 'A')
    await store.deleteMemoryEntry({ token: 'tok-del' }, 'long-term', 'A')

    expect((await store.getWorkingMemory(sessionId)).map((e) => e.key)).toEqual([
      'B',
    ])
    expect(await store.getLongTermMemory('tok-del')).toEqual([])
  })

  it('listSessions отдаёт флаг памяти', async () => {
    const token = `tok-list-${Date.now()}`
    await store.createSession(token, 'память', { memory: true })
    await store.createSession(token, 'обычная')
    const sessions = await store.listSessions(token)
    expect(sessions.map((s) => s.memoryEnabled).sort()).toEqual([false, true])
  })
})
