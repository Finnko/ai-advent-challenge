import { describe, expect, it } from 'vitest'
import { Agent } from '../domain/agent'
import type { AgentIdentity, CallLLM, LlmMessage } from '../domain/agent'
import type { InvariantGuard } from '../domain/invariants/guard'
import type { InvariantRecord } from '../domain/invariants/types'
import { createAgentTools } from '../domain/agent-tools'
import { TEST_NOW, createBooking, createCapabilities, createFakeStore } from './agent-testkit'

const employee: AgentIdentity = {
  name: 'Пётр',
  role: 'employee',
  title: 'Линейный сотрудник',
  subordinates: [],
  colleagues: ['Пётр'],
}

const invariant: InvariantRecord = {
  id: 1,
  token: 'test',
  slug: 'meeting-end-time',
  category: 'business',
  title: 'Встречи заканчиваются до 18:30',
  text: 'Встречи не назначаются позже 18:30.',
  check: 'meeting-end-time',
  pinned: true,
}

function agent(callLLM: CallLLM, invariants: InvariantRecord[], invariantGuard?: InvariantGuard) {
  return new Agent({
    capabilities: createCapabilities(employee, ['rescheduleBooking']),
    tools: createAgentTools(createFakeStore({ bookings: [createBooking()] }), TEST_NOW),
    judges: [],
    callLLM,
    model: 'test',
    today: '2026-09-10',
    invariants,
    invariantGuard,
  })
}

function scripted(
  messages: LlmMessage[][],
  finalize = 'Готово.',
  destination: { newRoom?: string; newTime?: string } = {},
): CallLLM {
  return async ({ messages: next, response_format }) => {
    messages.push(next)
    return {
      content: response_format
        ? JSON.stringify({
            tool: 'rescheduleBooking',
            args: {
              room: 'Ладога',
              date: '2026-09-11',
              time: '16:00',
              newRoom: destination.newRoom ?? 'Ладога',
              newDate: '2026-09-11',
              newTime: destination.newTime ?? '19:00',
            },
          })
        : finalize,
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      latencyMs: 1,
    }
  }
}

describe('agent invariants enforcement', () => {
  it('blocks a destination-slot violation before reschedule runs', async () => {
    const calls: LlmMessage[][] = []
    const run = await agent(scripted(calls), [invariant]).run('Перенеси встречу на 19:00')
    expect(run.blocked).toBe(true)
    expect(run.invariantHits).toEqual(['INV-1'])
    expect(run.answer).toContain('INV-1')
    const act = run.trace.find((step) => step.stage === 'act')
    expect(act && act.stage === 'act' ? act.invariantHits : []).toEqual(['INV-1'])
  })

  it('adds invariant instructions to decide and finalize prompts', async () => {
    const calls: LlmMessage[][] = []
    const run = await agent(
      async ({ messages, response_format }) => {
        calls.push(messages)
        return {
          content: response_format ? '{"tool":null,"args":{}}' : 'Готово.',
          usage: null,
          latencyMs: 0,
        }
      },
      [invariant],
    ).run('Что делать?')
    expect(run.ok).toBe(true)
    expect(calls[0].at(-1)?.content).toContain('Учитывай инварианты')
    expect(calls[1].at(-1)?.content).toContain('Если решение нарушает инвариант')
  })

  it('blocks an employee rescheduling into Orion', async () => {
    const calls: LlmMessage[][] = []
    const run = await agent(scripted(calls, 'Готово.', { newRoom: 'Орион', newTime: '16:00' }), [
      { ...invariant, id: 3, slug: 'orion-employee', title: 'Орион', text: 'Сотрудникам нельзя в «Орион».', check: 'orion-employee' },
    ]).run('Перенеси встречу в Орион')
    expect(run.blocked).toBe(true)
    expect(run.invariantHits).toEqual(['INV-3'])
    expect(run.answer).toContain('INV-3')
  })

  it('skips the LLM guard when a deterministic answer check already blocks', async () => {
    const custom: InvariantRecord = { ...invariant, id: 9, slug: 'custom', check: null, pinned: false, title: 'Правило', text: 'Соблюдай правило.' }
    const sqlite: InvariantRecord = { ...invariant, id: 4, slug: 'sqlite-only', check: 'sqlite-only', title: 'SQLite', text: 'Только SQLite.' }
    let guardCalls = 0
    const guard: InvariantGuard = async () => {
      guardCalls += 1
      return { status: 'fail', hits: ['INV-9'], reason: 'Нарушено.', usage: null, latencyMs: 0 }
    }
    const run = await new Agent({
      capabilities: createCapabilities(employee, []),
      tools: createAgentTools(createFakeStore(), TEST_NOW),
      judges: [],
      callLLM: async ({ response_format }) => ({
        content: response_format ? '{"tool":null,"args":{}}' : 'Используем PostgreSQL.',
        usage: null,
        latencyMs: 0,
      }),
      model: 'test',
      today: '2026-09-10',
      invariants: [custom, sqlite],
      invariantGuard: guard,
    }).run('Какую базу данных взять?')
    expect(guardCalls).toBe(0)
    expect(run.blocked).toBe(true)
    expect(run.invariantHits).toContain('INV-4')
  })

  it('blocks a failing custom invariant guard and cites its code', async () => {
    const custom: InvariantRecord = { ...invariant, id: 9, slug: 'custom', check: null, pinned: false, title: 'Правило', text: 'Соблюдай правило.' }
    const guard: InvariantGuard = async () => ({
      status: 'fail',
      hits: ['INV-9'],
      reason: 'Нарушено пользовательское правило.',
      usage: { prompt_tokens: 2, completion_tokens: 2 },
      latencyMs: 4,
    })
    const run = await agent(
      async ({ response_format }) => ({
        content: response_format ? '{"tool":null,"args":{}}' : 'Ответ.',
        usage: null,
        latencyMs: 0,
      }),
      [custom],
      guard,
    ).run('Ответь')
    expect(run.blocked).toBe(true)
    expect(run.invariantHits).toEqual(['INV-9'])
    expect(run.answer).toContain('INV-9')
    expect(run.trace.some((step) => step.stage === 'invariant-guard')).toBe(true)
  })
})
