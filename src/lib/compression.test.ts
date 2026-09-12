import { describe, expect, it } from 'vitest'
import {
  buildSummaryMessages,
  pendingToSummarize,
  prepareHistoryWithSummary,
  shouldRefresh,
  splitHistory,
  summaryTokensOf,
} from './compression'
import type { CompressionMessage, Summarize } from './compression'
import type { LlmMessage } from './agent'

function history(count: number, from = 1): CompressionMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: from + index,
    role: (from + index) % 2 === 1 ? 'user' : 'assistant',
    content: `сообщение ${from + index}`,
  }))
}

function fakeSummarizer(responses: string[] = ['СВОДКА']): {
  summarize: Summarize
  calls: LlmMessage[][]
} {
  const calls: LlmMessage[][] = []
  const summarize: Summarize = async (messages) => {
    calls.push(messages)
    const content = responses[Math.min(calls.length - 1, responses.length - 1)]
    return {
      content: content ?? 'СВОДКА',
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    }
  }
  return { summarize, calls }
}

describe('splitHistory', () => {
  it('оставляет последние N сообщений как есть', () => {
    const rows = history(12)
    const { agedOut, recent } = splitHistory(rows, 6)

    expect(recent.map((message) => message.id)).toEqual([7, 8, 9, 10, 11, 12])
    expect(agedOut.map((message) => message.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('выравнивает окно по началу user-хода', () => {
    const rows = history(11)
    const { agedOut, recent } = splitHistory(rows, 6)

    expect(recent[0].role).toBe('user')
    expect(recent.map((message) => message.id)).toEqual([5, 6, 7, 8, 9, 10, 11])
    expect(agedOut.map((message) => message.id)).toEqual([1, 2, 3, 4])
  })

  it('не состаривает историю короче окна', () => {
    const rows = history(4)
    const { agedOut, recent } = splitHistory(rows, 6)
    expect(agedOut).toHaveLength(0)
    expect(recent).toHaveLength(4)
  })
})

describe('pendingToSummarize / shouldRefresh', () => {
  it('берёт только сообщения после watermark', () => {
    const agedOut = history(4)
    const pending = pendingToSummarize(agedOut, 2)
    expect(pending.map((message) => message.id)).toEqual([3, 4])
  })

  it('срабатывает на пороге M', () => {
    expect(shouldRefresh(9)).toBe(false)
    expect(shouldRefresh(10)).toBe(true)
  })
})

describe('buildSummaryMessages', () => {
  it('собирает system+user и добавляет прошлую сводку', () => {
    const messages = buildSummaryMessages('старая сводка', history(2))
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toContain('старая сводка')
    expect(messages[1].content).toContain('Пользователь: сообщение 1')
    expect(messages[1].content).toContain('Ассистент: сообщение 2')
  })
})

describe('prepareHistoryWithSummary', () => {
  it('при выключенном сжатии отдаёт полную историю без сводки', async () => {
    const { summarize, calls } = fakeSummarizer()
    const rows = history(30)
    const prepared = await prepareHistoryWithSummary({
      rows,
      previousSummary: { text: 'старая сводка', throughMessageId: 4 },
      summarize,
      enabled: false,
    })

    expect(prepared.history).toHaveLength(30)
    expect(prepared.summary).toBeNull()
    expect(prepared.summarizedMessages).toBe(0)
    expect(prepared.refreshed).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('не сводит, пока не накопился порог M', async () => {
    const { summarize, calls } = fakeSummarizer()
    const prepared = await prepareHistoryWithSummary({
      rows: history(14),
      summarize,
      enabled: true,
    })

    expect(calls).toHaveLength(0)
    expect(prepared.summary).toBeNull()
    expect(prepared.refreshed).toBe(false)
    expect(prepared.history.map((message) => message.content)).toContain(
      'сообщение 14',
    )
  })

  it('сводит состаренное в сводку и двигает watermark', async () => {
    const { summarize, calls } = fakeSummarizer(['первая сводка'])
    const rows = history(20)
    const prepared = await prepareHistoryWithSummary({
      rows,
      summarize,
      enabled: true,
    })

    expect(calls).toHaveLength(1)
    expect(prepared.summary).toBe('первая сводка')
    expect(prepared.refreshed).toBe(true)
    expect(prepared.throughMessageId).toBe(14)
    expect(prepared.summarizedMessages).toBe(14)
    expect(prepared.summaryUsage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
    })
    expect(prepared.summaryTokens).toBe(summaryTokensOf('первая сводка'))
    expect(prepared.history).toHaveLength(6)
  })

  it('добавляет к прошлой сводке только новые сообщения (инкремент)', async () => {
    const { summarize, calls } = fakeSummarizer(['обновлённая сводка'])
    const rows = history(30)
    const prepared = await prepareHistoryWithSummary({
      rows,
      previousSummary: { text: 'первая сводка', throughMessageId: 14 },
      summarize,
      enabled: true,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0][1].content).toContain('первая сводка')
    expect(calls[0][1].content).not.toContain('сообщение 14')
    expect(calls[0][1].content).toContain('сообщение 15')
    expect(prepared.summary).toBe('обновлённая сводка')
    expect(prepared.throughMessageId).toBe(24)
    expect(prepared.summarizedMessages).toBe(24)
  })

  it('не двигает watermark, если новых сообщений ниже порога', async () => {
    const { summarize, calls } = fakeSummarizer(['не должна вызываться'])
    const rows = history(22)
    const prepared = await prepareHistoryWithSummary({
      rows,
      previousSummary: { text: 'первая сводка', throughMessageId: 14 },
      summarize,
      enabled: true,
    })

    expect(calls).toHaveLength(0)
    expect(prepared.refreshed).toBe(false)
    expect(prepared.summary).toBe('первая сводка')
    expect(prepared.throughMessageId).toBe(14)
  })

  it('интеграция: персистентная сводка переживает ходы и обновляется', async () => {
    const store: { summary: string | null; through: number } = {
      summary: null,
      through: 0,
    }
    const { summarize, calls } = fakeSummarizer(['S1', 'S2'])
    const runTurn = async (count: number) => {
      const prepared = await prepareHistoryWithSummary({
        rows: history(count),
        previousSummary: store.summary
          ? { text: store.summary, throughMessageId: store.through }
          : null,
        summarize,
      })
      if (prepared.refreshed && prepared.summary) {
        store.summary = prepared.summary
        store.through = prepared.throughMessageId
      }
      return prepared
    }

    const first = await runTurn(20)
    expect(first.refreshed).toBe(true)
    expect(store).toEqual({ summary: 'S1', through: 14 })

    const second = await runTurn(30)
    expect(second.refreshed).toBe(true)
    expect(store).toEqual({ summary: 'S2', through: 24 })
    expect(calls).toHaveLength(2)
    expect(calls[1][1].content).toContain('S1')
  })

  it('сохраняет прошлую сводку при ошибке суммаризатора', async () => {
    const summarize: Summarize = async () => {
      throw new Error('API недоступен')
    }
    const prepared = await prepareHistoryWithSummary({
      rows: history(20),
      previousSummary: { text: 'первая сводка', throughMessageId: 4 },
      summarize,
      enabled: true,
    })

    expect(prepared.refreshed).toBe(false)
    expect(prepared.summary).toBe('первая сводка')
    expect(prepared.throughMessageId).toBe(4)
  })
})
