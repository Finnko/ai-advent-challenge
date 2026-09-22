import { describe, expect, it } from 'vitest'
import type {
  AgentCapabilities,
  CallLLM,
  LlmMessage,
} from '../domain/agent'
import type { MemoryEntry } from '../domain/memory/types'
import type { InvariantRecord } from '../domain/invariants/types'
import type { TaskState } from '../domain/task/types'
import { createAgentTools } from '../domain/agent-tools'
import type { AgentRuntime } from '../server/agent-service.server'
import { runAgentTurn } from '../server/agent-turn.server'
import type { TurnDeps, TurnSession, TurnStore } from '../server/agent-turn.server'
import { TEST_NOW, createBooking, createFakeStore } from './agent-testkit'

type AppendedMessage = {
  role: 'user' | 'assistant' | 'task'
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
    steps: [],
    stepIndex: 0,
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
  const titles: string[] = []
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
    async updateSessionTitleIfDefault(_sessionId, title) {
      titles.push(title)
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
    titles,
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
  caps: AgentCapabilities = capabilities,
): TurnDeps {
  return {
    resolveCapabilities: async () => caps,
    store,
    runtime,
    now: () => TEST_NOW,
  }
}

describe('runAgentTurn', () => {
  it('передаёт глобальные инварианты в prompt и сохраняет hits', async () => {
    const { store, appended } = createTurnStore(turnSession())
    const invariant: InvariantRecord = {
      id: 4,
      token: 'tok-test',
      slug: 'sqlite-only',
      category: 'stack',
      title: 'Только SQLite',
      text: 'PostgreSQL не предлагать.',
      check: 'sqlite-only',
      pinned: true,
    }
    store.getInvariants = async () => [invariant]
    const captured: LlmMessage[][] = []
    const { runtime } = makeRuntime({
      callLLM: async ({ messages, response_format }) => {
        captured.push(messages)
        return {
          content: response_format ? '{"tool":null,"args":{}}' : 'Используем PostgreSQL.',
          usage: null,
          latencyMs: 0,
        }
      },
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'Предложи базу данных' },
      deps(store, runtime),
    )

    expect(result.run.blocked).toBe(true)
    expect(result.run.invariantHits).toEqual(['INV-4'])
    expect(captured[0].some((message) => message.role === 'system' && message.content.includes('Только SQLite'))).toBe(true)
    expect(appended[1]?.run).toBe(result.run)
  })

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

  it('проставляет заголовок сессии из названия задачи', async () => {
    const { store, titles } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          title: 'Бронирование переговорки на 21 сентября',
          stage: 'planning',
          step: 'Собираем параметры',
          expectedAction: { actor: 'user', description: 'Уточнить комнату' },
        },
        usage: null,
      }),
    })

    await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'забронируй переговорку' },
      deps(store, runtime),
    )

    expect(titles).toEqual(['Бронирование переговорки на 21 сентября'])
  })

  it('проставляет заголовок сессии из первого сообщения без задачи', async () => {
    const { store, titles } = createTurnStore(turnSession())
    const { runtime } = makeRuntime()

    await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'привет, как дела' },
      deps(store, runtime),
    )

    expect(titles).toEqual(['привет, как дела'])
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
    const { store, savedTask, appended } = createTurnStore(
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
    expect(appended.map((message) => message.role)).toEqual([
      'user',
      'task',
      'assistant',
    ])
    expect(appended[1].run).toMatchObject({
      kind: 'created',
      stage: 'planning',
    })
    const flat = captured.flat()
    expect(
      flat.some((message) => message.content.includes('СОСТОЯНИЕ ЗАДАЧИ:')),
    ).toBe(true)
    expect(
      flat.some(
        (message) =>
          message.role === 'user' &&
          message.content.includes('Этап планирования'),
      ),
    ).toBe(true)
  })

  it('продолжает с прежней стадии после паузы без повторных объяснений', async () => {
    const paused = taskState({ stage: 'paused', previousStage: 'planning' })
    const { store, getTask, appended } = createTurnStore(
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
    expect(appended.find((message) => message.role === 'task')?.run).toMatchObject(
      {
        kind: 'transition',
        from: 'paused',
        to: 'planning',
      },
    )
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

  it('не пускает task-сообщения в историю анализа и промпт', async () => {
    const { store } = createTurnStore(turnSession({ taskStateEnabled: true }))
    store.loadMessages = async () => [
      { id: 1, role: 'user', content: 'привет' },
      {
        id: 2,
        role: 'task',
        content: '',
        taskEvent: {
          kind: 'transition',
          from: 'planning',
          to: 'execution',
          reason: 'Приступаем',
          at: TEST_NOW.toISOString(),
        },
      },
      { id: 3, role: 'assistant', content: 'ок' },
    ]
    const analyzed: Array<{ role: string; content: string }> = []
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async (input) => {
        analyzed.push(...input.history)
        return { analysis: null, usage: null }
      },
    })

    await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'дальше' },
      deps(store, runtime),
    )

    expect(analyzed.length).toBeGreaterThan(0)
    expect(analyzed.every((row) => row.role !== 'task')).toBe(true)
    const userMessages = captured
      .flat()
      .filter((message) => message.role === 'user')
    expect(userMessages.some((message) => message.content === '')).toBe(false)
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

  it('после успешного действия переводит execution в validation', async () => {
    const booking = createBooking()
    const agentStore = createFakeStore({ bookings: [booking] })
    const { store, savedTask, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      store: agentStore,
      createTools: (s) => createAgentTools(s, TEST_NOW),
      callLLM: async ({ response_format }) => ({
        content: response_format
          ? JSON.stringify({ tool: 'cancelBooking', args: {} })
          : `Встреча отменена. Код подтверждения: ${booking.reference}.`,
        usage: { prompt_tokens: 3, completion_tokens: 2 },
        latencyMs: 0,
      }),
    })
    const caps: AgentCapabilities = {
      identity: {
        name: 'Пётр',
        role: 'employee',
        title: 'Линейный сотрудник',
        subordinates: [],
        colleagues: [],
      },
      allowedTools: ['cancelBooking'],
    }

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'отмени эту встречу' },
      deps(store, runtime, caps),
    )

    expect(result.taskState?.stage).toBe('validation')
    expect(getTask()?.stage).toBe('validation')
    expect(savedTask.at(-1)?.stage).toBe('validation')
    expect(
      appended.find((message) => message.role === 'task')?.run,
    ).toMatchObject({
      kind: 'transition',
      from: 'execution',
      to: 'validation',
    })
  })

  it('после действия двигает шаг, не меняя этап', async () => {
    const booking = createBooking()
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({
        stage: 'execution',
        steps: ['Забронировать', 'Пригласить'],
        stepIndex: 0,
        step: 'Забронировать',
      }),
    )
    const { runtime } = makeRuntime({
      store: createFakeStore({ bookings: [booking] }),
      createTools: (s) => createAgentTools(s, TEST_NOW),
      callLLM: async ({ response_format }) => ({
        content: response_format
          ? JSON.stringify({ tool: 'cancelBooking', args: {} })
          : `Встреча отменена. Код подтверждения: ${booking.reference}.`,
        usage: { prompt_tokens: 3, completion_tokens: 2 },
        latencyMs: 0,
      }),
    })
    const caps: AgentCapabilities = {
      identity: {
        name: 'Пётр',
        role: 'employee',
        title: 'Линейный сотрудник',
        subordinates: [],
        colleagues: [],
      },
      allowedTools: ['cancelBooking'],
    }

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'отмени эту встречу' },
      deps(store, runtime, caps),
    )

    expect(result.taskState?.stage).toBe('execution')
    expect(result.taskState?.stepIndex).toBe(1)
    expect(result.taskState?.step).toBe('Пригласить')
    expect(getTask()?.stepIndex).toBe(1)
    expect(
      appended.find((message) => message.role === 'task')?.run,
    ).toMatchObject({ kind: 'step', index: 1, to: 'Пригласить' })
  })

  it('после успешной проверки переводит validation в done', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'validation' }),
    )
    const { runtime } = makeRuntime({
      store: createFakeStore({ bookings: [createBooking()] }),
      createTools: (s) => createAgentTools(s, TEST_NOW),
      callLLM: async ({ response_format }) => ({
        content: response_format
          ? JSON.stringify({ tool: 'listBookings', args: {} })
          : 'Проверено: встреча на месте.',
        usage: { prompt_tokens: 3, completion_tokens: 2 },
        latencyMs: 0,
      }),
    })
    const caps: AgentCapabilities = {
      identity: {
        name: 'Пётр',
        role: 'employee',
        title: 'Линейный сотрудник',
        subordinates: [],
        colleagues: [],
      },
      allowedTools: ['listBookings'],
    }

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'проверь бронь' },
      deps(store, runtime, caps),
    )

    expect(result.taskState?.stage).toBe('done')
    expect(getTask()?.stage).toBe('done')
    expect(
      appended.find((message) => message.role === 'task')?.run,
    ).toMatchObject({
      kind: 'transition',
      from: 'validation',
      to: 'done',
    })
  })

  it('оставляет validation, если проверка инструментом не выполнялась', async () => {
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'validation' }),
    )
    const { runtime } = makeRuntime()

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'расскажи анекдот' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('validation')
    expect(getTask()?.stage).toBe('validation')
  })

  it('возвращает validation → execution при сообщении об ошибке', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'validation' }),
    )
    const { runtime } = makeRuntime()

    const result = await runAgentTurn(
      {
        token: 'tok-test',
        sessionId: 7,
        user: 'ты сделал неверно, переделай',
      },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('execution')
    expect(getTask()?.stage).toBe('execution')
    expect(
      appended.find((message) => message.role === 'task')?.run,
    ).toMatchObject({
      kind: 'transition',
      from: 'validation',
      to: 'execution',
    })
  })

  it('не переводит execution в validation, если задача на паузе', async () => {
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'paused',
          step: 'Пауза',
          expectedAction: { actor: 'user', description: 'Продолжить' },
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'пауза' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('paused')
    expect(getTask()?.stage).toBe('paused')
  })

  it('не перезаписывает паузу, пришедшую во время хода', async () => {
    const paused = taskState({ stage: 'paused', previousStage: 'execution' })
    const { store, getTask, savedTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => {
        await store.saveTaskState(7, paused)
        return {
          analysis: {
            stage: 'execution',
            step: 'Продолжаем',
            expectedAction: { actor: 'agent', description: 'Действие' },
          },
          usage: null,
        }
      },
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'давай ладогу на 45' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('paused')
    expect(getTask()?.stage).toBe('paused')
    expect(savedTask.every((state) => state.stage === 'paused')).toBe(true)
  })

  it('на паузе во время хода не добавляет ответ ассистента', async () => {
    const paused = taskState({ stage: 'paused', previousStage: 'planning' })
    const { store, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => {
        await store.saveTaskState(7, paused)
        return {
          analysis: {
            stage: 'planning',
            step: 'Уточняем',
            expectedAction: { actor: 'user', description: 'Уточнить' },
          },
          usage: null,
        }
      },
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'давай ладогу' },
      deps(store, runtime),
    )

    expect(result.run.answer).toBe('')
    expect(result.taskState?.stage).toBe('paused')
    expect(appended.map((message) => message.role)).toEqual(['user'])
  })

  it('на паузе обычное сообщение не возобновляет задачу', async () => {
    const { store, getTask, savedTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'paused', previousStage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'execution',
          step: 'Продолжаем',
          expectedAction: { actor: 'agent', description: 'Действие' },
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'давай ладогу на 45' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('paused')
    expect(getTask()?.stage).toBe('paused')
    expect(savedTask).toEqual([])
  })

  it('возобновляет паузу только по явной просьбе продолжить', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'paused', previousStage: 'execution' }),
    )
    const { runtime } = makeRuntime()

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'продолжим' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('execution')
    expect(getTask()?.stage).toBe('execution')
    expect(
      appended.find((message) => message.role === 'task')?.run,
    ).toMatchObject({
      kind: 'transition',
      from: 'paused',
      to: 'execution',
    })
  })

  it('отменяет задачу с паузы по тексту', async () => {
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'paused', previousStage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'cancelled',
          step: 'Отменяем',
          expectedAction: { actor: 'user', description: 'Отменено' },
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'отмени задачу' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('cancelled')
    expect(getTask()?.stage).toBe('cancelled')
  })

  it('на паузе не зовёт LLM и не отвечает', async () => {
    const { store, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'paused', previousStage: 'execution' }),
    )
    let analyzed = 0
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async () => {
        analyzed += 1
        return { analysis: null, usage: null }
      },
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'давай ладогу на 45' },
      deps(store, runtime),
    )

    expect(analyzed).toBe(0)
    expect(captured).toEqual([])
    expect(appended.map((message) => message.role)).toEqual(['user'])
    expect(result.taskState?.stage).toBe('paused')
    expect(result.run.answer).toBe('')
  })

  it('отменяет задачу по явной фразе на любом этапе', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'execution' }),
    )
    const { runtime, captured } = makeRuntime()

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'задача отменена' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('cancelled')
    expect(getTask()?.stage).toBe('cancelled')
    expect(captured).toEqual([])
    expect(appended.map((message) => message.role)).toEqual(['user', 'task'])
  })

  it('игнорирует отмену от анализатора без явной фразы', async () => {
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'execution' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'cancelled',
          step: 'Отменяем',
          expectedAction: { actor: 'user', description: 'Отменено' },
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'продолжай' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).not.toBe('cancelled')
    expect(getTask()?.stage).not.toBe('cancelled')
  })

  it('не пускает planning → execution без явного согласия', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime, captured } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'execution',
          step: 'Забронировать Ладогу',
          expectedAction: { actor: 'agent', description: 'bookMeetingRoom' },
          reason: 'Параметров достаточно',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      {
        token: 'tok-test',
        sessionId: 7,
        user: 'Ладога, завтра в 15:00, на час',
      },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(getTask()?.stage).toBe('planning')
    const rejected = appended.find(
      (message) =>
        message.role === 'task' &&
        (message.run as { kind?: string } | undefined)?.kind === 'rejected',
    )
    expect(rejected?.run).toMatchObject({
      kind: 'rejected',
      from: 'planning',
      to: 'execution',
    })
    const userMessages = captured
      .flat()
      .filter((message) => message.role === 'user')
    expect(userMessages.some((message) => message.content.includes('отклонена'))).toBe(
      true,
    )
  })

  it('не пускает planning → execution по настойчивой фразе «давай»', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'execution',
          step: 'Забронировать',
          expectedAction: { actor: 'agent', description: 'bookMeetingRoom' },
          reason: 'Пользователь торопит',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'нет давай пропусти бронируем' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(getTask()?.stage).toBe('planning')
    const rejected = appended.find(
      (message) =>
        message.role === 'task' &&
        (message.run as { kind?: string } | undefined)?.kind === 'rejected',
    )
    expect(rejected?.run).toMatchObject({
      kind: 'rejected',
      from: 'planning',
      to: 'execution',
    })
  })

  it('пускает planning → execution по явному согласию', async () => {
    const { store, getTask } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'execution',
          step: 'Забронировать Ладогу',
          expectedAction: { actor: 'agent', description: 'bookMeetingRoom' },
          reason: 'Пользователь подтвердил план',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'да, приступай' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('execution')
    expect(getTask()?.stage).toBe('execution')
  })

  it('не пускает execution, пока в плане есть незакрытые пункты', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'execution',
          step: 'Забронировать',
          expectedAction: {
            actor: 'user',
            description: 'Уточнить способ приглашения Ивана',
          },
          reason: 'Пользователь подтвердил',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'подтверждаю, запускай' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(getTask()?.stage).toBe('planning')
    const rejected = appended.find(
      (message) =>
        message.role === 'task' &&
        (message.run as { kind?: string } | undefined)?.kind === 'rejected',
    )
    expect(rejected?.run).toMatchObject({
      kind: 'rejected',
      from: 'planning',
      to: 'execution',
      reason: 'В плане остались незакрытые пункты — сначала утвердите все пункты.',
    })
  })

  it('отклоняет неадъяцентный прыжок планирование → готово', async () => {
    const { store, getTask, appended } = createTurnStore(
      turnSession({ taskStateEnabled: true }),
      taskState({ stage: 'planning' }),
    )
    const { runtime } = makeRuntime({
      analyzeTaskState: async () => ({
        analysis: {
          stage: 'done',
          step: 'Готово',
          expectedAction: { actor: 'user', description: 'Задача завершена' },
          reason: 'Пользователь доволен',
        },
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'спасибо' },
      deps(store, runtime),
    )

    expect(result.taskState?.stage).toBe('planning')
    expect(getTask()?.stage).toBe('planning')
    const rejected = appended.find(
      (message) =>
        message.role === 'task' &&
        (message.run as { kind?: string } | undefined)?.kind === 'rejected',
    )
    expect(rejected?.run).toMatchObject({
      kind: 'rejected',
      from: 'planning',
      to: 'done',
    })
  })
})
