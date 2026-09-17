import { describe, expect, it } from 'vitest'
import type {
  AgentCapabilities,
  CallLLM,
  LlmMessage,
} from '../domain/agent'
import type { MemoryEntry } from '../domain/memory/types'
import type { TaskState } from '../domain/task/types'
import type { AgentRuntime } from '../server/agent-service.server'
import { runAgentTurn } from '../server/agent-turn.server'
import type { TurnDeps, TurnSession, TurnStore } from '../server/agent-turn.server'
import { TEST_NOW, createFakeStore } from './agent-testkit'

type AppendedMessage = {
  role: 'user' | 'assistant'
  content: string
  run?: unknown
}

function turnSession(overrides: Partial<TurnSession> = {}): TurnSession {
  return {
    token: 'tok-test',
    strategy: 'none',
    scenario: null,
    windowSize: 10,
    memoryEnabled: false,
    profileId: null,
    taskStateEnabled: false,
    invariantSetId: null,
    ...overrides,
  }
}

function taskState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    title: 'Задача',
    stage: 'execution',
    previousStage: null,
    step: 'шаг',
    expectedAction: { actor: 'agent', description: 'действие' },
    updatedAt: TEST_NOW.toISOString(),
    history: [],
    ...overrides,
  }
}

function createTurnStore(
  session: TurnSession,
  initialTask: TaskState | null = null,
) {
  const appended: AppendedMessage[] = []
  const savedWorking: MemoryEntry[][] = []
  const savedLongTerm: MemoryEntry[][] = []
  const savedTask: TaskState[] = []
  let task: TaskState | null = initialTask
  const store: TurnStore = {
    async getSession() {
      return session
    },
    async getActiveBranchTitle() {
      return undefined
    },
    async loadMessages() {
      return []
    },
    async getSummary() {
      return null
    },
    async saveSummary() {},
    async getFacts() {
      return []
    },
    async saveFacts() {},
    async getWorkingMemory() {
      return []
    },
    async getLongTermMemory() {
      return []
    },
    async saveWorkingMemory(_sessionId, entries) {
      savedWorking.push(entries)
    },
    async saveLongTermMemory(_token, entries) {
      savedLongTerm.push(entries)
    },
    async getProfile() {
      return null
    },
    async getTaskState() {
      return task
    },
    async saveTaskState(_sessionId, state) {
      task = state
      savedTask.push(state)
    },
    async appendMessage(_sessionId, role, content, run) {
      appended.push({ role, content, run })
    },
  }
  return {
    store,
    appended,
    savedWorking,
    savedLongTerm,
    savedTask,
    getTask: () => task,
  }
}

function scriptedCallLLM(captured: LlmMessage[][]): CallLLM {
  return async ({ messages, response_format }) => {
    captured.push(messages)
    return {
      content: response_format ? '{"tool": null, "args": {}}' : 'Готово.',
      usage: { prompt_tokens: 3, completion_tokens: 2 },
      latencyMs: 0,
    }
  }
}

function makeRuntime(overrides: Partial<AgentRuntime> = {}): {
  runtime: AgentRuntime
  captured: LlmMessage[][]
} {
  const captured: LlmMessage[][] = []
  const unused = async () => {
    throw new Error('runtime helper не должен вызываться в этом тесте')
  }
  const runtime: AgentRuntime = {
    callLLM: scriptedCallLLM(captured),
    summarize: unused,
    extractFacts: unused,
    extractMemories: async () => ({ candidates: [], usage: null }),
    analyzeTaskState: async () => ({ analysis: null, usage: null }),
    store: createFakeStore(),
    createTools: () => [],
    ...overrides,
  }
  return { runtime, captured }
}

const capabilities: AgentCapabilities = {
  identity: {
    name: 'Пётр',
    role: 'employee',
    title: 'Линейный сотрудник',
    subordinates: [],
    colleagues: [],
  },
  allowedTools: [],
}

function deps(
  store: TurnStore,
  runtime: AgentRuntime,
): TurnDeps {
  return {
    resolveCapabilities: async () => capabilities,
    store,
    runtime,
    now: () => TEST_NOW,
  }
}

describe('runAgentTurn', () => {
  it('отклоняет чужую сессию', async () => {
    const { store } = createTurnStore(turnSession({ token: 'other-token' }))
    const { runtime } = makeRuntime()

    await expect(
      runAgentTurn(
        { token: 'tok-test', sessionId: 7, user: 'привет' },
        deps(store, runtime),
      ),
    ).rejects.toThrow('Сессия не найдена')
  })

  it('гидратирует состояние, выполняет Ход и сохраняет две реплики', async () => {
    const { store, appended, savedWorking, savedLongTerm } =
      createTurnStore(turnSession())
    const { runtime } = makeRuntime()

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'привет' },
      deps(store, runtime),
    )

    expect(result.run.ok).toBe(true)
    expect(result.run.answer).toBe('Готово.')
    expect(appended.map((message) => [message.role, message.content])).toEqual([
      ['user', 'привет'],
      ['assistant', 'Готово.'],
    ])
    expect(appended[1].run).toBe(result.run)
    expect(savedWorking).toEqual([])
    expect(savedLongTerm).toEqual([])
  })

  it('при включённой памяти извлекает, сохраняет и добавляет блок в промпт', async () => {
    const { store, savedWorking, savedLongTerm } = createTurnStore(
      turnSession({ memoryEnabled: true }),
    )
    const { runtime, captured } = makeRuntime({
      extractMemories: async () => ({
        candidates: [{ layer: 'working', key: 'Цель', value: 'запуск' }],
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'зафиксируй цель' },
      deps(store, runtime),
    )

    expect(result.run.ok).toBe(true)
    expect(savedWorking).toHaveLength(1)
    expect(savedWorking[0].map((entry) => entry.key)).toEqual(['Цель'])
    expect(savedLongTerm).toEqual([])

    const systemContents = captured
      .flat()
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
    expect(
      systemContents.some((content) =>
        content.includes('РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ:'),
      ),
    ).toBe(true)
  })

  it('ведёт состояние задачи и кладёт блок в промпт', async () => {
    const { store, savedTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
    )
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          title: 'Забронировать переговорку',
          stage: 'planning',
          step: 'Собираем параметры',
          expectedAction: {
            actor: 'user',
            description: 'Указать число участников',
          },
          reason: 'Новая задача',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'нужна переговорка' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(result.run.taskState?.title).toBe('Забронировать переговорку')
    expect(savedTask).toHaveLength(1)
    const flat = captured.flat()
    expect(
      flat.some((message) => message.content.includes('СОСТОЯНИЕ ЗАДАЧИ:')),
    ).toBe(true)
    expect(
      flat.some(
        (message) =>
          message.role === 'user' &&
          message.content.includes('Ожидается ход пользователя'),
      ),
    ).toBe(true)
  })

  it('продолжает с прежней стадии после паузы без повторных объяснений', async () => {
    const paused = taskState({ stage: 'paused', previousStage: 'planning' })
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      paused,
    )
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'planning',
          step: 'Ждём параметры',
          expectedAction: { actor: 'user', description: 'Назвать дату' },
          reason: 'Продолжение после паузы',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'продолжим' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(getTask()?.previousStage).toBeNull()
    expect(
      captured
        .flat()
        .some(
          (message) =>
            message.role === 'user' &&
            message.content.includes('Текущий этап задачи: planning'),
        ),
    ).toBe(true)
  })

  it('при выключенном состоянии задачи не зовёт анализатор и не кладёт блок', async () => {
    const { store, savedTask } = createTurnStore(turnSession())
    let called = false
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async () => {
        called = true
        return { analysis: null, usage: null }
      },
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'привет' },
      deps(store, runtime),
    )

    expect(called).toBe(false)
    expect(savedTask).toEqual([])
    expect(result.taskState).toBeNull()
    expect(
      captured.flat().some((message) => message.content.includes('СОСТОЯНИЕ ЗАДАЧИ:')),
    ).toBe(false)
  })
})
