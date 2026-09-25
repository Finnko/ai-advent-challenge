import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resumeTask } from '../domain/task/state'
import type { TaskState } from '../domain/task/types'

type Store = typeof import('../server/store.server')
type TaskStateServer = typeof import('../server/task-state.server')

let tempDir: string
let store: Store
let taskStateServer: TaskStateServer

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agent-task-'))
  const dbPath = join(tempDir, 'test.sqlite')
  await writeFile(dbPath, '')
  process.env.AGENT_DB_PATH = dbPath
  vi.resetModules()
  store = await import('../server/store.server')
  taskStateServer = await import('../server/task-state.server')
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
    approved: false,
    step: 'Собираем параметры',
    steps: ['Собираем параметры'],
    stepIndex: 0,
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

  it('сохраняет согласие на изменяющие действия', async () => {
    const sessionId = await store.createSession('tok-approved', 'согласие')
    await store.saveTaskState(
      sessionId,
      taskState({ stage: 'execution', approved: true }),
    )
    expect((await store.getTaskState(sessionId))?.approved).toBe(true)
    await store.saveTaskState(
      sessionId,
      taskState({ stage: 'execution', approved: false }),
    )
    expect((await store.getTaskState(sessionId))?.approved).toBe(false)
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

  it('кнопочная пауза и продолжение пишут событие в ленту', async () => {
    const sessionId = await store.createSession('tok-action', 'кнопки')
    await store.saveTaskState(sessionId, taskState({ stage: 'execution' }))

    await taskStateServer.applyTaskAction(sessionId, 'pause')
    await taskStateServer.applyTaskAction(sessionId, 'resume')

    const messages = await store.loadMessages(sessionId)
    const taskMessages = messages.filter((message) => message.role === 'task')
    expect(taskMessages).toHaveLength(2)
    expect(taskMessages[0].taskEvent).toMatchObject({
      kind: 'transition',
      from: 'execution',
      to: 'paused',
    })
    expect(taskMessages[1].taskEvent).toMatchObject({
      kind: 'transition',
      from: 'paused',
      to: 'execution',
    })
  })

  it('обновляет дефолтный заголовок сессии', async () => {
    const sessionId = await store.createSession('tok-title', 'Новая сессия')
    await store.updateSessionTitleIfDefault(sessionId, 'Бронирование')
    expect((await store.getSession(sessionId))?.title).toBe('Бронирование')
    await store.updateSessionTitleIfDefault(sessionId, 'Другое')
    expect((await store.getSession(sessionId))?.title).toBe('Бронирование')
  })

  it('не перетирает заданный заголовок сессии', async () => {
    const sessionId = await store.createSession('tok-title2', 'Своя сессия')
    await store.updateSessionTitleIfDefault(sessionId, 'Новое')
    expect((await store.getSession(sessionId))?.title).toBe('Своя сессия')
  })
})
