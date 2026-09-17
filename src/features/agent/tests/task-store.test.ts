import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resumeTask } from '../domain/task/state'
import type { TaskState } from '../domain/task/types'

type Store = typeof import('../server/store.server')

let tempDir: string
let store: Store

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-task-'))
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

function taskState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    title: 'Забронировать переговорку',
    stage: 'planning',
    previousStage: null,
    step: 'Собираем параметры',
    expectedAction: { actor: 'user', description: 'Назвать дату' },
    updatedAt: '2026-09-10T12:00:00.000Z',
    history: [],
    ...overrides,
  }
}

describe('task state store', () => {
  it('включает состояние задачи по умолчанию и хранит снимок', async () => {
    const sessionId = await store.createSession('tok-task', 'задача')
    expect((await store.getSession(sessionId))?.taskStateEnabled).toBe(true)

    expect(await store.getTaskState(sessionId)).toBeNull()
    await store.saveTaskState(sessionId, taskState())
    const saved = await store.getTaskState(sessionId)
    expect(saved).toMatchObject({
      title: 'Забронировать переговорку',
      stage: 'planning',
      step: 'Собираем параметры',
    })
    expect(saved?.expectedAction).toEqual({
      actor: 'user',
      description: 'Назвать дату',
    })
  })

  it('обновляет снимок и сохраняет историю переходов', async () => {
    const sessionId = await store.createSession('tok-task', 'история')
    const paused = {
      ...taskState({ stage: 'execution' }),
      stage: 'paused' as const,
      previousStage: 'execution' as const,
      history: [
        {
          from: 'planning' as const,
          to: 'execution' as const,
          reason: 'Приступаем',
          at: '2026-09-10T12:01:00.000Z',
        },
        {
          from: 'execution' as const,
          to: 'paused' as const,
          reason: 'Пауза',
          at: '2026-09-10T12:02:00.000Z',
        },
      ],
    }
    await store.saveTaskState(sessionId, paused)

    const resumed = resumeTask(paused, '2026-09-10T12:03:00.000Z')
    await store.saveTaskState(sessionId, resumed)

    const saved = await store.getTaskState(sessionId)
    expect(saved?.stage).toBe('execution')
    expect(saved?.previousStage).toBeNull()
    expect(saved?.history).toHaveLength(3)
    expect(saved?.history.at(-1)).toMatchObject({
      from: 'paused',
      to: 'execution',
    })
  })

  it('изолирует состояние по сессиям', async () => {
    const a = await store.createSession('tok-iso', 'A')
    const b = await store.createSession('tok-iso', 'B')
    await store.saveTaskState(a, taskState({ title: 'A' }))
    expect((await store.getTaskState(a))?.title).toBe('A')
    expect(await store.getTaskState(b)).toBeNull()
  })

  it('удаляет состояние вместе с сессией', async () => {
    const sessionId = await store.createSession('tok-delete', 'удаляю')
    await store.saveTaskState(sessionId, taskState())
    await store.deleteSession(sessionId)
    expect(await store.getTaskState(sessionId)).toBeNull()
  })
})
