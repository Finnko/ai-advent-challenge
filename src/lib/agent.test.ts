import { describe, expect, it } from 'vitest'
import { AGENT_JUDGES, Agent } from './agent'
import type {
  AgentIdentity,
  CallLLM,
  LlmMessage,
  LlmReply,
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

function buildAgent(options: {
  callLLM: CallLLM
  identity?: AgentIdentity
  allowedTools?: string[]
  store?: FakeStore
  context?: string
  enforceContextBudget?: boolean
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
    enforceContextBudget: options.enforceContextBudget,
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

  it('включает в decide-промпт правила приглашения и контекст', async () => {
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

    const decideSystem = calls.find((call) => call.isDecide)?.messages[0]
      .content
    expect(decideSystem).toBeDefined()
    expect(decideSystem).toContain('inviteToMeeting')
    expect(decideSystem).toContain('approveVacation')
    expect(decideSystem).toContain('cancelBooking')
    expect(decideSystem).toContain('Иван')
    expect(decideSystem).toContain('Последняя доступная встреча')
    expect(decideSystem).toContain('Последняя заявка на отпуск')
    expect(decideSystem).not.toContain('не вызывай инструмент')
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
