import { describe, expect, it } from 'vitest'
import { parseAnswerResponse } from '../domain/answer-format'

describe('parseAnswerResponse', () => {
  it('parses the JSON contract with quotes', () => {
    const parsed = parseAnswerResponse(
      '{"answer":"Ответ [1].","quotes":[{"n":1,"text":"цитата"}]}',
    )
    expect(parsed.format).toBe('json')
    expect(parsed.answer).toBe('Ответ [1].')
    expect(parsed.quotes).toEqual([{ n: 1, text: 'цитата' }])
  })

  it('parses fenced JSON', () => {
    const parsed = parseAnswerResponse(
      '```json\n{"answer":"A","quotes":[]}\n```',
    )
    expect(parsed.format).toBe('json')
    expect(parsed.answer).toBe('A')
    expect(parsed.quotes).toEqual([])
  })

  it('drops malformed quotes', () => {
    const parsed = parseAnswerResponse(
      '{"answer":"A","quotes":[{"n":0,"text":"x"},{"n":1,"text":""},{"n":2,"text":"ok"}]}',
    )
    expect(parsed.quotes).toEqual([{ n: 2, text: 'ok' }])
  })

  it('falls back to plain text without quotes', () => {
    const parsed = parseAnswerResponse('Просто ответ без JSON.')
    expect(parsed.format).toBe('text')
    expect(parsed.answer).toBe('Просто ответ без JSON.')
    expect(parsed.quotes).toEqual([])
  })
})
