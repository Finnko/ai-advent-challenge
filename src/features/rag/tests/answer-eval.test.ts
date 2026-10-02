import { describe, expect, it } from 'vitest'
import {
  citedTitles,
  matchExpected,
  normalizeFact,
  parseCitations,
  verdictFor,
  verifyQuotes,
} from '../domain/answer-eval'
import type { Chunk } from '../domain/types'

function chunk(title: string): Chunk {
  return {
    chunkId: title,
    strategy: 'fixed',
    docId: title,
    source: 'https://example.org',
    title,
    section: null,
    sectionPath: [],
    position: 0,
    charStart: 0,
    charEnd: 0,
    nTokens: 0,
    crossesSection: false,
    text: '',
  }
}

describe('normalizeFact', () => {
  it('collapses digit-group spaces and punctuation', () => {
    expect(normalizeFact('1 190 254')).toBe('1190254')
    expect(normalizeFact('Гото-Предестинация')).toBe('гото предестинация')
    expect(normalizeFact('РД-105')).toBe('рд 105')
  })
})

describe('matchExpected', () => {
  it('splits matched and missing facts', () => {
    const result = matchExpected('Основан в 1586 году, [1]', ['1586', '1700'])
    expect(result.matched).toEqual(['1586'])
    expect(result.missing).toEqual(['1700'])
  })
})

describe('parseCitations', () => {
  it('collects unique positive indices sorted', () => {
    expect(parseCitations('Факт [2], ещё [1] и снова [2]')).toEqual([1, 2])
  })
})

describe('citedTitles', () => {
  it('maps citation numbers to chunk titles', () => {
    expect(
      citedTitles('смотри [1] и [2]', [chunk('Воронеж'), chunk('Москва')]),
    ).toEqual(['Воронеж', 'Москва'])
  })
})

describe('verifyQuotes', () => {
  it('verifies verbatim quotes and rejects paraphrases', () => {
    const chunkWithText: Chunk = {
      ...chunk('Воронеж'),
      text: 'Воронеж основан в 1586 году.',
    }
    const quotes = verifyQuotes(
      [
        { n: 1, text: 'основан в 1586 году' },
        { n: 1, text: 'основан в 1700 году' },
        { n: 2, text: 'что-то' },
      ],
      [chunkWithText],
    )
    expect(quotes[0].verified).toBe(true)
    expect(quotes[0].chunkId).toBe('Воронеж')
    expect(quotes[1].verified).toBe(false)
    expect(quotes[2].verified).toBe(false)
    expect(quotes[2].chunkId).toBeNull()
  })
})

describe('verdictFor', () => {
  const rag = 'Воронеж основан в 1586 году [1].'

  it('marks a fully matched grounded RAG answer as correct', () => {
    expect(
      verdictFor({
        mode: 'rag',
        answer: rag,
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [chunk('Воронеж')],
      }),
    ).toBe('correct')
  })

  it('marks a baseline answer correct without requiring citations', () => {
    expect(
      verdictFor({
        mode: 'baseline',
        answer: 'Основан в 1586 году.',
        expected: ['1586'],
        expectedSources: [],
        chunks: [],
      }),
    ).toBe('correct')
  })

  it('marks partial when some expected facts are missing', () => {
    expect(
      verdictFor({
        mode: 'rag',
        answer: 'В 1586 году [1].',
        expected: ['1586', '1700'],
        expectedSources: ['Воронеж'],
        chunks: [chunk('Воронеж')],
      }),
    ).toBe('partial')
  })

  it('marks wrong when nothing matches', () => {
    expect(
      verdictFor({
        mode: 'baseline',
        answer: 'Не знаю.',
        expected: ['1586'],
        expectedSources: [],
        chunks: [],
      }),
    ).toBe('wrong')
  })

  it('marks ungrounded when a RAG answer has no citation', () => {
    expect(
      verdictFor({
        mode: 'rag',
        answer: 'Основан в 1586 году.',
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [chunk('Воронеж')],
      }),
    ).toBe('ungrounded')
  })

  it('marks ungrounded when citations point away from expected sources', () => {
    expect(
      verdictFor({
        mode: 'rag',
        answer: 'Основан в 1586 году [1].',
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [chunk('Москва')],
      }),
    ).toBe('ungrounded')
  })

  it('requires verified quotes to back the matched facts', () => {
    const source: Chunk = {
      ...chunk('Воронеж'),
      text: 'Воронеж основан в 1586 году.',
    }
    expect(
      verdictFor({
        mode: 'rag',
        answer: rag,
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [source],
        quotes: verifyQuotes([{ n: 1, text: 'основан в 1586 году' }], [source]),
      }),
    ).toBe('correct')
    expect(
      verdictFor({
        mode: 'rag',
        answer: rag,
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [source],
        quotes: [],
      }),
    ).toBe('ungrounded')
    expect(
      verdictFor({
        mode: 'rag',
        answer: rag,
        expected: ['1586'],
        expectedSources: ['Воронеж'],
        chunks: [source],
        quotes: verifyQuotes([{ n: 1, text: 'другой текст' }], [source]),
      }),
    ).toBe('ungrounded')
  })
})
