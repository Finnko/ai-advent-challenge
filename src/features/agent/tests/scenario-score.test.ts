import { describe, expect, it } from 'vitest'
import type { AgentRunResult } from '../domain/agent'
import type { RetrievedSource } from '../domain/capabilities/types'
import type { ScenarioStep } from '../data/scenarios'
import { scoreStep, stepPassed, statesEarlier } from '../domain/scenario-score'

function run(overrides: Partial<AgentRunResult> = {}): AgentRunResult {
  return {
    ok: true,
    blocked: false,
    reason: null,
    answer: '',
    trace: [],
    verdicts: [],
    usage: null,
    latencyMs: 0,
    model: 'test',
    tokens: {
      requestTokens: 0,
      historyTokens: 0,
      historyTokensSent: 0,
      contextTokens: 0,
      contextMessages: 0,
      responseTokens: 0,
      promptTokensActual: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      costUsd: 0,
    },
    contextNote: null,
    invariantHits: [],
    ...overrides,
  }
}

function source(title: string): RetrievedSource {
  return {
    chunkId: title,
    title,
    section: null,
    source: 'wiki',
    text: title,
    score: 1,
  }
}

describe('scoreStep grounding', () => {
  it('не требует опору на мета-шаге без ожиданий фактов', () => {
    const step: ScenarioStep = {
      question: 'Напомни, какие два города мы сравниваем.',
      expectGrounding: false,
    }
    const verdict = scoreStep(
      step,
      run({
        answer: 'Мы сравниваем Москву и Санкт-Петербург.',
        grounding: 'ungrounded',
        sources: [source('Москва')],
      }),
    )
    expect(verdict.groundingOk).toBe(true)
    expect(stepPassed(verdict)).toBe(true)
  })

  it('по-прежнему требует опору на фактическом шаге', () => {
    const step: ScenarioStep = {
      question: 'В каком году основан каждый из них?',
      expectFacts: ['1147'],
      expectSources: ['Москва'],
    }
    const verdict = scoreStep(
      step,
      run({
        answer: 'Москва — 1147.',
        grounding: 'ungrounded',
        sources: [source('Москва')],
      }),
    )
    expect(verdict.groundingOk).toBe(false)
    expect(stepPassed(verdict)).toBe(false)
  })
})

describe('scoreStep ordering', () => {
  const step: ScenarioStep = {
    question: 'Какой из этих двух городов основан раньше?',
    expectEarlier: { earlier: 'Москва', later: 'Санкт-Петербург' },
  }

  it('засчитывает, когда раньше назван верный город', () => {
    const verdict = scoreStep(
      step,
      run({
        answer: 'Москва основана раньше. Первое упоминание — 1147 год.',
        grounding: 'grounded',
        sources: [source('Москва')],
      }),
    )
    expect(verdict.orderOk).toBe(true)
    expect(stepPassed(verdict)).toBe(true)
  })

  it('засчитывает оба города в одном предложении, если верный идёт первым', () => {
    const verdict = scoreStep(
      step,
      run({
        answer:
          'Раньше основана Москва: 1147 год, а Санкт-Петербург — 1703 год.',
        grounding: 'grounded',
        sources: [source('Москва')],
      }),
    )
    expect(verdict.orderOk).toBe(true)
  })

  it('ловит перевёрнутый заголовок, даже если вывод верный', () => {
    const verdict = scoreStep(
      step,
      run({
        answer:
          'Санкт-Петербург основан раньше.\n\nВывод: на самом деле древнее Москва (1147 год).',
        grounding: 'grounded',
        sources: [source('Москва')],
      }),
    )
    expect(verdict.orderOk).toBe(false)
    expect(stepPassed(verdict)).toBe(false)
  })
})

describe('statesEarlier', () => {
  it('ловит перевёрнутый заголовок, даже если вывод верный', () => {
    expect(
      statesEarlier(
        'Санкт-Петербург основан раньше.\n\nВывод: на самом деле древнее Москва (1147 год).',
        'Москва',
        'Санкт-Петербург',
      ),
    ).toBe(false)
  })

  it('принимает ответ, где сначала сравнение, а вывод — в конце', () => {
    expect(
      statesEarlier(
        'Сравнение: 1147 < 1703, меньшее значение (1147 год) — раньше.\n\nВывод: раньше основана Москва (1147), Санкт-Петербург — позже (1703).',
        'Москва',
        'Санкт-Петербург',
      ),
    ).toBe(true)
  })

  it('принимает ответ без явного «раньше», если верный город не назван раньше', () => {
    expect(
      statesEarlier(
        'Раньше основана Москва: 1147 год, а Санкт-Петербург — 1703 год.',
        'Москва',
        'Санкт-Петербург',
      ),
    ).toBe(true)
  })
})
