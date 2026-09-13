import { describe, expect, it } from 'vitest'
import { noneStrategy } from './context/none'
import { summaryStrategy } from './context/summary'
import { CONTEXT_STRATEGY_IDS, resolveStrategy } from './context/registry'
import type { CompressionMessage, Summarize } from './compression'

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

describe('реестр стратегий', () => {
  it('содержит активные стратегии и резолвит их по id', () => {
    expect(CONTEXT_STRATEGY_IDS).toEqual(
      expect.arrayContaining(['summary', 'none']),
    )
    expect(resolveStrategy('none').id).toBe('none')
    expect(resolveStrategy('summary').id).toBe('summary')
  })

  it('падает на неизвестной стратегии', () => {
    expect(() => resolveStrategy('window' as never)).toThrow(
      'Неизвестная стратегия',
    )
  })
})

describe('noneStrategy', () => {
  it('возвращает всю историю без блоков и заметок', async () => {
    const result = await noneStrategy.prepare({
      rows: history(20),
      previousSummary: null,
      summarize: fakeSummarizer().summarize,
      saveSummary: () => {},
    })

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
    const result = await summaryStrategy.prepare({
      rows: history(20),
      previousSummary: null,
      summarize,
      saveSummary: (summary, throughMessageId) => {
        saved.push({ summary, through: throughMessageId })
      },
    })

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
    const result = await summaryStrategy.prepare({
      rows: history(14),
      previousSummary: null,
      summarize,
      saveSummary: (...args) => {
        saved.push(args)
      },
    })

    expect(result.context.blocks).toHaveLength(0)
    expect(result.context.note).toBeNull()
    expect(saved).toHaveLength(0)
  })
})
