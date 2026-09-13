import { describe, expect, it } from 'vitest'
import { AGENT_JUDGES, Agent } from './agent'
import type {
  AgentIdentity,
  CallLLM,
  LlmMessage,
  LlmReply,
  PreparedContext,
} from './agent'
import { TOOLS_BY_ROLE, createAgentTools } from './agent-tools'
import {
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
}): Agent {
  const identity = options.identity ?? createIdentity()
  const store = options.store ?? createFakeStore()
  const allowedTools =
    options.allowedTools ?? createAgentTools(store).map((tool) => tool.name)
  return new Agent({
    capabilities: createCapabilities(identity, allowedTools),
    tools: createAgentTools(store),
    judges: AGENT_JUDGES,
    callLLM: options.callLLM,
    model: 'test-model',
    today: '2026-09-10',
    context: options.context,
    contextBudgetTokens: options.contextBudgetTokens,
  })
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
    expect(calls.filter((call) => call.isDecide)).toHaveLength(2)
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

    expect(run.tokens.responseTokens).toBe(10)
    expect(run.tokens.promptTokensActual).toBe(20)
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
