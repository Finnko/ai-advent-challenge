import { describe, expect, it } from 'vitest'
import { branchStrategy } from '../domain/context/branch'
import { factsStrategy } from '../domain/context/facts'
import { noneStrategy } from '../domain/context/none'
import { summaryStrategy } from '../domain/context/summary'
import {
  CONTEXT_STRATEGY_IDS,
  resolveStrategy,
} from '../domain/context/registry'
import type { PrepareInput } from '../domain/context/types'
import { WINDOW_SIZE, windowStrategy } from '../domain/context/window'
import type { CompressionMessage, Summarize } from '../domain/compression'
import type { ExtractFacts, Fact } from '../domain/facts'

function history(count: number, from = 1): CompressionMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: from + index,
    role: (from + index) % 2 === 1 ? 'user' : 'assistant',
    content: `сообщение ${from + index}`,
  }))
}

function fakeSummarizer(responses: string[] = ['первая сводка']): {
  summarize: Summarize
  calls: number[]
} {
  const calls: number[] = []
  const summarize: Summarize = async () => {
    calls.push(1)
    const content =
      responses[Math.min(calls.length - 1, responses.length - 1)] ?? 'сводка'
    return {
      content,
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    }
  }
  return { summarize, calls }
}

function baseInput(overrides: Partial<PrepareInput> = {}): PrepareInput {
  return {
    rows: history(20),
    request: 'новый запрос',
    previousSummary: null,
    summarize: fakeSummarizer().summarize,
    saveSummary: () => {},
    facts: [],
    extractFacts: async () => ({ facts: [], usage: null }),
    saveFacts: () => {},
    ...overrides,
  }
}

describe('реестр стратегий', () => {
  it('содержит пять стратегий и резолвит их по id', () => {
    expect(CONTEXT_STRATEGY_IDS).toEqual(
      expect.arrayContaining(['summary', 'none', 'window', 'facts', 'branch']),
    )
    for (const id of CONTEXT_STRATEGY_IDS) {
      expect(resolveStrategy(id).id).toBe(id)
    }
  })

  it('падает на неизвестной стратегии', () => {
    expect(() => resolveStrategy('unknown' as never)).toThrow(
      'Неизвестная стратегия',
    )
  })
})

describe('noneStrategy', () => {
  it('возвращает всю историю без блоков и заметок', async () => {
    const result = await noneStrategy.prepare(baseInput())

    expect(result.context.history).toHaveLength(20)
    expect(result.context.blocks).toHaveLength(0)
    expect(result.context.note).toBeNull()
    expect(result.auxUsage).toBeNull()
  })
})

describe('summaryStrategy', () => {
  it('сворачивает старую историю и сохраняет сводку через saveSummary', async () => {
    const { summarize, calls } = fakeSummarizer(['первая сводка'])
    const saved: Array<{ summary: string; through: number }> = []
    const result = await summaryStrategy.prepare(
      baseInput({
        previousSummary: null,
        summarize,
        saveSummary: (summary, throughMessageId) => {
          saved.push({ summary, through: throughMessageId })
        },
      }),
    )

    expect(calls).toHaveLength(1)
    expect(result.context.history).toHaveLength(6)
    expect(result.context.blocks).toHaveLength(1)
    expect(result.context.blocks[0].kind).toBe('summary')
    expect(result.context.blocks[0].content).toContain(
      'СВОДКА ПРЕДЫДУЩЕГО ДИАЛОГА',
    )
    expect(result.context.blocks[0].content).toContain('первая сводка')
    expect(result.context.note).toEqual({
      kind: 'summary',
      label: 'Сводка истории',
      text: 'первая сводка',
      messages: 14,
      throughMessageId: 14,
    })
    expect(saved).toEqual([{ summary: 'первая сводка', through: 14 }])
    expect(result.auxUsage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
    })
  })

  it('не сворачивает и не сохраняет, пока не накопился порог', async () => {
    const { summarize } = fakeSummarizer()
    const saved: unknown[] = []
    const result = await summaryStrategy.prepare(
      baseInput({
        rows: history(14),
        previousSummary: null,
        summarize,
        saveSummary: (...args) => {
          saved.push(args)
        },
      }),
    )

    expect(result.context.blocks).toHaveLength(0)
    expect(result.context.note).toBeNull()
    expect(saved).toHaveLength(0)
  })
})

describe('windowStrategy', () => {
  it('оставляет последние N сообщений и сообщает, сколько отброшено', async () => {
    const result = await windowStrategy.prepare(baseInput())

    expect(result.context.history).toHaveLength(WINDOW_SIZE)
    expect(result.context.history[0]).toEqual({
      role: 'user',
      content: 'сообщение 11',
    })
    expect(result.context.blocks).toHaveLength(0)
    expect(result.context.note?.kind).toBe('window')
    expect(result.context.note?.messages).toBe(10)
    expect(result.auxUsage).toBeNull()
  })

  it('не режет короткую историю', async () => {
    const result = await windowStrategy.prepare(
      baseInput({ rows: history(6) }),
    )

    expect(result.context.history).toHaveLength(6)
    expect(result.context.note).toBeNull()
  })
})

describe('factsStrategy', () => {
  const extracted: Fact[] = [
    { key: 'Цель', value: 'собрать ТЗ' },
    { key: 'Бюджет', value: '100к' },
  ]

  function fakeExtractor(): { extractFacts: ExtractFacts; calls: string[] } {
    const calls: string[] = []
    const extractFacts: ExtractFacts = async (_previous, userMessage) => {
      calls.push(userMessage)
      return {
        facts: extracted,
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      }
    }
    return { extractFacts, calls }
  }

  it('обновляет факты, сохраняет их и добавляет facts-блок', async () => {
    const { extractFacts, calls } = fakeExtractor()
    const saved: Fact[][] = []
    const result = await factsStrategy.prepare(
      baseInput({
        request: 'бюджет 100к',
        facts: [{ key: 'Цель', value: 'собрать ТЗ' }],
        extractFacts,
        saveFacts: (next) => {
          saved.push(next)
        },
      }),
    )

    expect(calls).toEqual(['бюджет 100к'])
    expect(saved).toHaveLength(1)
    expect(saved[0]).toEqual(extracted)
    expect(result.context.history).toHaveLength(WINDOW_SIZE)
    expect(result.context.blocks).toHaveLength(1)
    expect(result.context.blocks[0].kind).toBe('facts')
    expect(result.context.blocks[0].content).toContain('Бюджет: 100к')
    expect(result.context.note?.kind).toBe('facts')
    expect(result.auxUsage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 4,
    })
  })

  it('переживает падение экстрактора и оставляет прежние факты', async () => {
    const saved: Fact[][] = []
    const result = await factsStrategy.prepare(
      baseInput({
        facts: [{ key: 'Цель', value: 'собрать ТЗ' }],
        extractFacts: async () => {
          throw new Error('boom')
        },
        saveFacts: (next) => {
          saved.push(next)
        },
      }),
    )

    expect(saved).toHaveLength(0)
    expect(result.context.blocks[0].content).toContain('собрать ТЗ')
    expect(result.auxUsage).toBeNull()
  })
})

describe('branchStrategy', () => {
  it('отдаёт историю ветки как есть', async () => {
    const result = await branchStrategy.prepare(
      baseInput({ branchLabel: 'main' }),
    )

    expect(result.context.history).toHaveLength(20)
    expect(result.context.blocks).toHaveLength(0)
    expect(result.context.note?.kind).toBe('branch')
    expect(result.context.note?.text).toBe('main')
    expect(result.auxUsage).toBeNull()
  })
})
