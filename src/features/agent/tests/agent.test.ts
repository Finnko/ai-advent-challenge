import { describe, expect, it } from 'vitest'
import { AGENT_JUDGES, Agent } from '../domain/agent'
import type {
  AgentIdentity,
  AgentTool,
  CallLLM,
  LlmMessage,
  LlmReply,
  PreparedContext,
} from '../domain/agent'
import { TOOLS_BY_ROLE, createAgentTools } from '../domain/agent-tools'
import type { TaskState } from '../domain/task/types'
import {
  TEST_NOW,
  createBooking,
  createCapabilities,
  createFakeStore,
  createIdentity,
  createManagerIdentity,
  type FakeStore,
} from './agent-testkit'

type CapturedCall = { messages: LlmMessage[]; isDecide: boolean }

function scriptedLLM(script: {
  decide?: string | string[]
  finalize?: string
}): {
  callLLM: CallLLM
  calls: CapturedCall[]
} {
  const calls: CapturedCall[] = []
  let decideIndex = 0
  const callLLM: CallLLM = async ({ messages, response_format }) => {
    const isDecide = Boolean(response_format)
    calls.push({ messages, isDecide })
    const decideScript = Array.isArray(script.decide)
      ? (script.decide[Math.min(decideIndex, script.decide.length - 1)] ?? '')
      : (script.decide ?? '')
    if (isDecide) {
      decideIndex += 1
    }
    const reply: LlmReply = {
      content: isDecide ? decideScript : (script.finalize ?? ''),
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      latencyMs: 1,
    }
    return reply
  }
  return { callLLM, calls }
}

function prepared(history: LlmMessage[] = []): PreparedContext {
  return { history, blocks: [], note: null }
}

function buildAgent(options: {
  callLLM: CallLLM
  identity?: AgentIdentity
  allowedTools?: string[]
  store?: FakeStore
  context?: string
  contextBudgetTokens?: number
  responseLanguage?: string | null
  taskState?: TaskState
  taskStateEnabled?: boolean
  taskNote?: string
  maxActionsPerTurn?: number
  isPaused?: () => boolean | Promise<boolean>
}): Agent {
  const identity = options.identity ?? createIdentity()
  const store = options.store ?? createFakeStore()
  const tools = createAgentTools(store, TEST_NOW)
  const allowedTools = options.allowedTools ?? tools.map((tool) => tool.name)
  return new Agent({
    capabilities: createCapabilities(identity, allowedTools),
    tools,
    judges: AGENT_JUDGES,
    callLLM: options.callLLM,
    model: 'test-model',
    today: '2026-09-10',
    responseLanguage: options.responseLanguage,
    context: options.context,
    contextBudgetTokens: options.contextBudgetTokens,
    taskState: options.taskState,
    taskStateEnabled: options.taskStateEnabled,
    taskNote: options.taskNote,
    maxActionsPerTurn: options.maxActionsPerTurn,
    isPaused: options.isPaused,
  })
}

function buildTaskState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    title: 'Задача',
    stage: 'execution',
    previousStage: null,
    approved: false,
    step: 'шаг',
    steps: [],
    stepIndex: 0,
    expectedAction: { actor: 'agent', description: 'действие' },
    updatedAt: TEST_NOW.toISOString(),
    history: [],
    ...overrides,
  }
}

describe('Agent pipeline', () => {
  it('выполняет выбранный инструмент и включает код подтверждения', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.ok).toBe(true)
    expect(run.blocked).toBe(false)
    expect(run.answer).toContain('BOOK-TEST01')
    expect(store.bookings[0].participants).toEqual(['Иван'])
    const act = run.trace.find((step) => step.stage === 'act')
    expect(act && act.stage === 'act' ? act.tool : null).toBe('inviteToMeeting')
  })

  it('отменяет встречу подчинённого по fallback из контекста', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Иван' })],
    })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({ tool: 'cancelBooking', args: {} }),
      finalize: 'Встреча отменена. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({
      store,
      callLLM,
      identity: createManagerIdentity(),
    }).run('Отмени эту встречу')

    expect(run.ok).toBe(true)
    expect(store.bookings).toHaveLength(0)
  })

  it('повторяет decide при action-запросе с tool: null', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM, calls } = scriptedLLM({
      decide: [
        '{"tool": null, "args": {}}',
        JSON.stringify({
          tool: 'inviteToMeeting',
          args: { participants: ['Иван'] },
        }),
      ],
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.ok).toBe(true)
    expect(calls.filter((call) => call.isDecide)).toHaveLength(3)
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })

  it('не повторяет decide для обычного вопроса', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Всё хорошо!',
    })
    await buildAgent({ callLLM }).run('Как дела?')

    expect(calls.filter((call) => call.isDecide)).toHaveLength(1)
  })

  it('не выполняет act, когда планировщик вернул tool: null', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Привет! Чем помочь?',
    })
    const run = await buildAgent({ callLLM }).run('Привет')

    expect(run.trace.some((step) => step.stage === 'act')).toBe(false)
    expect(run.answer).toBe('Привет! Чем помочь?')
    expect(calls.filter((call) => call.isDecide)).toHaveLength(1)
  })

  it('блокирует ответ без кода подтверждения (output-policy)', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён.',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.blocked).toBe(true)
    expect(run.answer).toContain('Действие отклонено')
    expect(run.reason).toContain('код подтверждения')
  })

  it('блокирует недоступный роли инструмент (business-rules)', async () => {
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'approveVacation',
        args: { employeeName: 'Мария', start: '2026-09-01', end: '2026-09-12' },
      }),
      finalize: 'Готово',
    })
    const run = await buildAgent({
      callLLM,
      allowedTools: TOOLS_BY_ROLE.employee,
    }).run('Согласуй отпуск Петру')

    expect(run.blocked).toBe(true)
    expect(run.reason).toContain('approveVacation')
  })

  it('классифицирует неизвестный инструмент как недоступный', async () => {
    const { callLLM } = scriptedLLM({
      decide: '{"tool": "teleport", "args": {}}',
      finalize: 'Готово',
    })
    const run = await buildAgent({ callLLM }).run('Телепортируй меня')

    expect(run.blocked).toBe(true)
    expect(run.reason).toContain('teleport')
  })

  it('держит инструменты и контекст в хвосте decide-запроса', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    await buildAgent({
      callLLM,
      identity: createManagerIdentity(),
      context:
        'Последняя доступная встреча (пользователя или команды): «Ладога», 2026-09-11 16:00.\n' +
        'Последняя заявка на отпуск от подчинённых: Пётр, с 2026-09-01 по 2026-09-12 (ожидает согласования).',
    }).run('Позови Ивана')

    const decideCall = calls.find((call) => call.isDecide)
    const decideUser =
      decideCall?.messages[decideCall.messages.length - 1]?.content ?? ''
    expect(decideUser).toContain('inviteToMeeting')
    expect(decideUser).toContain('approveVacation')
    expect(decideUser).toContain('cancelBooking')
    expect(decideUser).toContain('Иван')
    expect(decideUser).toContain('Последняя доступная встреча')
    expect(decideUser).toContain('Последняя заявка на отпуск')
    expect(decideUser).not.toContain('не вызывай инструмент')
  })

  it('показывает «Орион» только руководителю в decide-промпте', async () => {
    const employee = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    await buildAgent({
      callLLM: employee.callLLM,
      identity: createIdentity(),
    }).run('Покажи свободные комнаты')
    const employeeDecide = employee.calls.find((call) => call.isDecide)
    const employeeUser =
      employeeDecide?.messages[employeeDecide.messages.length - 1]?.content ?? ''
    expect(employeeUser).not.toContain('Орион')

    const manager = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    await buildAgent({
      callLLM: manager.callLLM,
      identity: createManagerIdentity(),
    }).run('Покажи свободные комнаты')
    const managerDecide = manager.calls.find((call) => call.isDecide)
    const managerUser =
      managerDecide?.messages[managerDecide.messages.length - 1]?.content ?? ''
    expect(managerUser).toContain('Орион')
  })

  it('делает базовый system одинаковым для decide и finalize', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    await buildAgent({ callLLM }).run('Как дела?')

    const decide = calls.find((call) => call.isDecide)
    const finalize = calls.find((call) => !call.isDecide)
    expect(decide?.messages[0]).toEqual(finalize?.messages[0])
    expect(decide?.messages[0].role).toBe('system')
  })

  it('вставляет context-блок отдельным system-сообщением в decide и finalize', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM, calls } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const theContext: PreparedContext = {
      history: [],
      blocks: [
        {
          kind: 'summary',
          content:
            'СВОДКА ПРЕДЫДУЩЕГО ДИАЛОГА:\nРанее обсуждали планёрку и отпуск.',
        },
      ],
      note: {
        kind: 'summary',
        label: 'Сводка истории',
        text: 'Ранее обсуждали планёрку и отпуск.',
        messages: 4,
        throughMessageId: 4,
      },
    }
    const run = await buildAgent({ store, callLLM }).run(
      'Позови Ивана',
      theContext,
    )

    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const call of calls) {
      const summary = call.messages.find(
        (message) =>
          message.role === 'system' &&
          message.content.includes('СВОДКА ПРЕДЫДУЩЕГО ДИАЛОГА'),
      )
      expect(summary?.content).toContain('планёрку')
    }
    expect(run.tokens.contextMessages).toBe(4)
    expect(run.tokens.contextTokens).toBeGreaterThan(0)
    expect(run.contextNote?.text).toContain('планёрку')
  })

  it('приоритезирует блоки памяти над прошлыми ответами истории', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Бюджет: 2 миллиона.',
    })
    const memoryContext: PreparedContext = {
      history: [
        { role: 'user', content: 'какой бюджет у нас' },
        {
          role: 'assistant',
          content: 'В долговременной памяти нет данных о бюджете.',
        },
      ],
      blocks: [
        {
          kind: 'long-term',
          content:
            'ДОЛГОВРЕМЕННАЯ ПАМЯТЬ (профиль, решения, знания):\n- бюджет: 2 миллиона',
        },
      ],
      note: null,
    }
    await buildAgent({ callLLM }).run('какой бюджет?', memoryContext)

    for (const call of calls) {
      const lastUser = [...call.messages]
        .reverse()
        .find((message) => message.role === 'user')
      expect(lastUser?.content).toContain('доверяй памяти')

      const memoryIndex = call.messages.findIndex((message) =>
        message.content.includes('- бюджет: 2 миллиона'),
      )
      const staleIndex = call.messages.findIndex((message) =>
        message.content.includes('нет данных о бюджете'),
      )
      expect(memoryIndex).toBeGreaterThan(staleIndex)
      expect(memoryIndex).toBeGreaterThan(-1)
      expect(call.messages[memoryIndex + 1]).toBe(lastUser)
    }
  })

  it('ставит блок профиля перед памятью и историей', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    const context: PreparedContext = {
      history: [
        { role: 'user', content: 'старая реплика' },
        { role: 'assistant', content: 'старый ответ' },
      ],
      blocks: [
        {
          kind: 'profile',
          content: 'ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:\n- Тон: деловой',
        },
        {
          kind: 'long-term',
          content:
            'ДОЛГОВРЕМЕННАЯ ПАМЯТЬ (профиль, решения, знания):\n- бюджет: 2 миллиона',
        },
        {
          kind: 'working',
          content: 'РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ:\n- цель: запуск',
        },
      ],
      note: null,
    }
    await buildAgent({ callLLM }).run('как дела?', context)

    for (const call of calls) {
      const profileIndex = call.messages.findIndex((message) =>
        message.content.includes('ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:'),
      )
      const longTermIndex = call.messages.findIndex((message) =>
        message.content.includes('ДОЛГОВРЕМЕННАЯ ПАМЯТЬ'),
      )
      const workingIndex = call.messages.findIndex((message) =>
        message.content.includes('РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ'),
      )
      const historyIndex = call.messages.findIndex((message) =>
        message.content.includes('старая реплика'),
      )
      const lastUser = [...call.messages]
        .reverse()
        .find((message) => message.role === 'user')
      expect(historyIndex).toBeGreaterThan(-1)
      expect(profileIndex).toBeGreaterThan(historyIndex)
      expect(longTermIndex).toBeGreaterThan(profileIndex)
      expect(workingIndex).toBeGreaterThan(longTermIndex)
      expect(call.messages[workingIndex + 1]).toBe(lastUser)
      expect(lastUser?.content).toContain('ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ')
      expect(lastUser?.content).toContain('доверяй памяти')
    }
  })

  it('не добавляет директиву приоритета памяти без memory-блоков', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок',
    })
    const summaryContext: PreparedContext = {
      history: [],
      blocks: [{ kind: 'summary', content: 'СВОДКА ПРЕДЫДУЩЕГО ДИАЛОГА:\nПлан.' }],
      note: null,
    }
    await buildAgent({ callLLM }).run('Как дела?', summaryContext)

    const finalize = calls.find((call) => !call.isDecide)
    const joined = finalize?.messages.map((m) => m.content).join('\n') ?? ''
    expect(joined).not.toContain('доверяй памяти')
  })

  it('не отправляет сырую историю в finalize при отчёте инструмента', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM, calls } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    await buildAgent({ store, callLLM }).run(
      'Позови Ивана',
      prepared([
        { role: 'user', content: 'старая реплика пользователя' },
        { role: 'assistant', content: 'старый ответ ассистента' },
      ]),
    )

    const finalize = calls.find((call) => !call.isDecide)
    const joined = finalize?.messages.map((m) => m.content).join('\n') ?? ''
    expect(joined).not.toContain('старая реплика пользователя')
    expect(joined).not.toContain('старый ответ ассистента')
    expect(joined).toContain('ОТЧЁТ ИНСТРУМЕНТА')
  })

  it('отправляет сырую историю в finalize, когда инструмент не вызывался', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Всё хорошо!',
    })
    await buildAgent({ callLLM }).run(
      'Как у тебя дела?',
      prepared([
        { role: 'user', content: 'старая реплика пользователя' },
        { role: 'assistant', content: 'старый ответ ассистента' },
      ]),
    )

    const finalize = calls.find((call) => !call.isDecide)
    const joined = finalize?.messages.map((m) => m.content).join('\n') ?? ''
    expect(joined).toContain('старая реплика пользователя')
  })

  it('учитывает cache-hit/miss токены в стоимости', async () => {
    const callLLM: CallLLM = async ({ response_format }) => ({
      content: response_format ? '{"tool": null, "args": {}}' : 'Ответ.',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        prompt_cache_hit_tokens: 80,
        prompt_cache_miss_tokens: 20,
      },
      latencyMs: 1,
    })
    const run = await buildAgent({ callLLM }).run('Привет')

    expect(run.tokens.cacheHitTokens).toBe(160)
    expect(run.tokens.cacheMissTokens).toBe(40)
    const expected =
      (160 / 1_000_000) * 0.003 +
      (40 / 1_000_000) * 0.15 +
      (20 / 1_000_000) * 0.6
    expect(run.tokens.costUsd).toBeCloseTo(expected, 12)
  })

  it('считает токены ответа и фактический prompt по вызовам', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.tokens.responseTokens).toBe(15)
    expect(run.tokens.promptTokensActual).toBe(30)
  })

  it('отклоняет запрос, не влезающий в контекстный бюджет', async () => {
    const { callLLM } = scriptedLLM({})
    const run = await buildAgent({
      callLLM,
      contextBudgetTokens: 10,
    }).run('x'.repeat(5000))

    expect(run.blocked).toBe(true)
    expect(run.reason).toContain('контекстный бюджет')
  })

  it('отклоняет пустое и слишком длинное сообщение (input policy)', async () => {
    const { callLLM } = scriptedLLM({})
    const agent = buildAgent({ callLLM })
    expect((await agent.run('   ')).blocked).toBe(true)
    expect((await agent.run('x'.repeat(30_001))).blocked).toBe(true)
  })
})

describe('этап planning и мульти-действия', () => {
  it('в planning скрывает изменяющие инструменты из decide', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Предлагаю забронировать «Ладогу». Приступаем?',
    })
    await buildAgent({
      callLLM,
      taskState: buildTaskState({ stage: 'planning' }),
    }).run('Забронируй Ладогу завтра')

    const decideUser = calls.find((call) => call.isDecide)?.messages.at(-1)
      ?.content
    expect(decideUser).not.toContain('bookMeetingRoom')
    expect(decideUser).not.toContain('inviteToMeeting')
    expect(decideUser).toContain('listBookings')
  })

  it('в planning показывает параметры gated MCP-инструмента и дефолты в finalize', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'План: создать расписание для Санкт-Петербурга.',
    })
    const scheduleTool: AgentTool = {
      name: 'mcp_schedule_weather_report',
      description: 'Создаёт периодический сбор погоды по городу',
      argsExample:
        '{ "city": "<строка>", "intervalMinutes": <целое>, "windowHours": <целое> }',
      roles: ['employee', 'manager'],
      run: async () => ({ ok: true, text: 'ok', reference: null }),
    }
    const identity = createIdentity()
    await new Agent({
      capabilities: createCapabilities(identity, ['mcp_schedule_weather_report']),
      tools: [scheduleTool],
      judges: AGENT_JUDGES,
      callLLM,
      model: 'test-model',
      today: '2026-09-10',
      taskState: buildTaskState({ stage: 'planning' }),
    }).run('запланируй погодный отчёт по Санкт-Петербургу')

    const finalizeUser =
      calls.find((call) => !call.isDecide)?.messages.at(-1)?.content ?? ''
    expect(finalizeUser).toContain('станут доступны после подтверждения плана')
    expect(finalizeUser).toContain('intervalMinutes')
    expect(finalizeUser).toContain('каждые 60 минут')
  })

  it('в planning не выполняет изменяющий инструмент, даже если он выбран', async () => {
    const store = createFakeStore()
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'bookMeetingRoom',
        args: {
          room: 'Иртыш',
          date: '2026-09-11',
          time: '16:00',
          title: 'Синк',
        },
      }),
      finalize: 'Приступаем?',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskState: buildTaskState({ stage: 'planning' }),
    }).run('Забронируй Иртыш')

    expect(store.bookings).toHaveLength(0)
    expect(run.answer).toContain('planning')
  })

  it('fail-closed: без состояния задачи изменяющие инструменты запрещены', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Приступаем?',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskStateEnabled: true,
    }).run('Позови Ивана')

    expect(store.bookings[0].participants).toEqual([])
    expect(run.answer).toContain('Состояние задачи недоступно')
  })

  it('fail-closed не мешает утверждённому исполнению', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskStateEnabled: true,
      taskState: buildTaskState({
        stage: 'execution',
        approved: true,
        steps: ['Пригласить Ивана'],
      }),
    }).run('Позови Ивана')

    expect(run.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })

  it('в planning разрешает справочные инструменты', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({ tool: 'listBookings', args: {} }),
      finalize: 'Вот ваши встречи.',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskState: buildTaskState({ stage: 'planning' }),
    }).run('Какие у меня встречи?')

    const acts = run.trace.filter((step) => step.stage === 'act')
    expect(acts).toHaveLength(1)
    expect(run.ok).toBe(true)
  })

  it('в validation не выполняет изменяющий инструмент', async () => {
    const store = createFakeStore()
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'bookMeetingRoom',
        args: { room: 'Иртыш', date: '2026-09-11', time: '16:00' },
      }),
      finalize: 'Проверка.',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskState: buildTaskState({ stage: 'validation' }),
    }).run('Забронируй ещё одну')

    expect(store.bookings).toHaveLength(0)
    expect(run.answer).toContain('validation')
  })

  it('в validation разрешает справочные инструменты', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({ tool: 'listBookings', args: {} }),
      finalize: 'Проверено: встреча на месте.',
    })
    const run = await buildAgent({
      store,
      callLLM,
      taskState: buildTaskState({ stage: 'validation' }),
    }).run('Проверь бронь')

    expect(run.trace.filter((step) => step.stage === 'act')).toHaveLength(1)
    expect(run.ok).toBe(true)
  })

  it('подмешивает note об отклонённом переходе в decide и finalize', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'План предложен.',
    })
    await buildAgent({
      callLLM,
      taskState: buildTaskState({ stage: 'planning' }),
      taskNote:
        'Попытка перейти planning → execution отклонена: План ещё не утверждён пользователем.',
    }).run('Забронируй Ладогу')

    const decideUser =
      calls.find((call) => call.isDecide)?.messages.at(-1)?.content ?? ''
    const finalizeUser =
      calls.find((call) => !call.isDecide)?.messages.at(-1)?.content ?? ''
    expect(decideUser).toContain('отклонена')
    expect(finalizeUser).toContain('отклонена')
  })

  it('подсказывает в decide, что участники передаются именами', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Ок.',
    })
    await buildAgent({
      callLLM,
      taskState: buildTaskState({ stage: 'execution', approved: true }),
    }).run('позови Ивана')

    const decideUser =
      calls.find((call) => call.isDecide)?.messages.at(-1)?.content ?? ''
    expect(decideUser).toContain('Участники передаются именами')
  })

  it('останавливает цикл по паузе между действиями', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: [
        JSON.stringify({
          tool: 'inviteToMeeting',
          args: { participants: ['Иван'] },
        }),
        JSON.stringify({
          tool: 'inviteToMeeting',
          args: { participants: ['Мария'] },
        }),
        '{"tool": null, "args": {}}',
      ],
      finalize: 'Иван приглашён, дальше пауза. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({
      store,
      callLLM,
      maxActionsPerTurn: 5,
      isPaused: () => store.bookings[0].participants.length > 0,
    }).run('Позови всех')

    expect(run.trace.filter((step) => step.stage === 'act')).toHaveLength(1)
    expect(store.bookings[0].participants).toEqual(['Иван'])
    expect(run.ok).toBe(true)
  })

  it('на паузе не зовёт LLM и не отвечает', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM, calls } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Выполнение приостановлено.',
    })
    const run = await buildAgent({ store, callLLM, isPaused: () => true }).run(
      'Позови Ивана',
    )

    expect(calls).toEqual([])
    expect(run.trace.some((step) => step.stage === 'act')).toBe(false)
    expect(store.bookings[0].participants).toEqual([])
    expect(run.answer).toBe('')
  })

  it('не выполняет действие и не отвечает, если пауза пришла во время decide', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM, calls } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Выполнение приостановлено.',
    })
    let paused = false
    const run = await buildAgent({
      store,
      callLLM: async (options) => {
        paused = true
        return callLLM(options)
      },
      isPaused: () => paused,
    }).run('Позови Ивана')

    expect(calls.filter((call) => call.isDecide)).toHaveLength(1)
    expect(run.trace.some((step) => step.stage === 'act')).toBe(false)
    expect(store.bookings[0].participants).toEqual([])
    expect(run.answer).toBe('')
  })

  it('не отвечает, если пауза пришла во время decide без действий', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    let paused = false
    const received: boolean[] = []
    const run = await buildAgent({
      store,
      callLLM: async ({ response_format }) => {
        received.push(Boolean(response_format))
        paused = true
        return {
          content: '{"tool": null, "args": {}}',
          usage: { prompt_tokens: 10, completion_tokens: 5 },
          latencyMs: 1,
        }
      },
      isPaused: () => paused,
    }).run('давай ладогу')

    expect(received).toEqual([true])
    expect(run.answer).toBe('')
    expect(run.trace.some((step) => step.stage === 'finalize')).toBe(false)
  })

  it('выполняет несколько действий за ход и собирает все коды', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: [
        JSON.stringify({
          tool: 'inviteToMeeting',
          args: { participants: ['Иван'] },
        }),
        JSON.stringify({
          tool: 'inviteToMeeting',
          args: { participants: ['Мария'] },
        }),
        '{"tool": null, "args": {}}',
      ],
      finalize: 'Иван и Мария приглашены. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({ store, callLLM, maxActionsPerTurn: 5 }).run(
      'Позови Ивана и Марию',
    )

    expect(run.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Иван', 'Мария'])
    expect(run.trace.filter((step) => step.stage === 'act')).toHaveLength(2)
    expect(run.answer).toContain('BOOK-TEST01')
  })

  it('останавливает цикл на maxActionsPerTurn', async () => {
    let index = 0
    const callLLM: CallLLM = async ({ response_format }) => {
      if (!response_format) {
        return {
          content: 'Готово.',
          usage: { prompt_tokens: 10, completion_tokens: 5 },
          latencyMs: 1,
        }
      }
      index += 1
      return {
        content: JSON.stringify({
          tool: 'listAvailableRooms',
          args: {
            date: `2026-09-${String(index).padStart(2, '0')}`,
            time: '10:00',
          },
        }),
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        latencyMs: 1,
      }
    }
    const run = await buildAgent({ callLLM, maxActionsPerTurn: 3 }).run(
      'Покажи свободные комнаты на несколько дат',
    )

    expect(run.trace.filter((step) => step.stage === 'act')).toHaveLength(3)
  })

  it('не повторяет одно и то же действие', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({
        tool: 'inviteToMeeting',
        args: { participants: ['Иван'] },
      }),
      finalize: 'Иван приглашён. Код подтверждения: BOOK-TEST01',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.trace.filter((step) => step.stage === 'act')).toHaveLength(1)
  })

  it('блокирует ответ, приписывающий невыполненное приглашение', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({ tool: 'listBookings', args: {} }),
      finalize: 'Приглашения отправлены: Иван.',
    })
    const run = await buildAgent({ store, callLLM }).run('Позови Ивана')

    expect(run.blocked).toBe(true)
    expect(run.reason).toContain('приглашени')
  })

  it('не блокирует справочный ответ о существующей встрече', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const { callLLM } = scriptedLLM({
      decide: JSON.stringify({ tool: 'listBookings', args: {} }),
      finalize:
        'У вас забронирована встреча 2026-09-11 в 16:00. Иван приглашён.',
    })
    const run = await buildAgent({ store, callLLM }).run('Какие у меня встречи?')

    expect(run.blocked).toBe(false)
  })
})

describe('язык ответа', () => {
  function lastFinalizeUser(calls: CapturedCall[]): string {
    const finalize = calls.find((call) => !call.isDecide)
    return finalize?.messages.at(-1)?.content ?? ''
  }

  it('подчиняется языку профиля и не навязывает русский', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Bonjour !',
    })
    const run = await buildAgent({
      callLLM,
      responseLanguage: 'французский',
    }).run('Привет', {
      history: [],
      blocks: [
        {
          kind: 'profile',
          content: 'ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:\n- Язык: французский',
        },
      ],
      note: null,
    })

    expect(run.ok).toBe(true)
    const finalizeUser = lastFinalizeUser(calls)
    expect(finalizeUser).toContain('французский')
    expect(finalizeUser).not.toContain('по-русски')
  })

  it('дефолтом просит отвечать по-русски', async () => {
    const { callLLM, calls } = scriptedLLM({
      decide: '{"tool": null, "args": {}}',
      finalize: 'Привет',
    })
    const run = await buildAgent({ callLLM }).run('Привет', prepared())

    expect(run.ok).toBe(true)
    expect(lastFinalizeUser(calls)).toContain('по-русски')
  })
})
