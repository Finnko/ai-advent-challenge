import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '../domain/format'

describe('formatTimestamp', () => {
  it('переводит ISO-дату в локальные дату и время', () => {
    expect(formatTimestamp('2026-10-17T14:05:00.000Z')).toMatch(
      /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/,
    )
  })

  it('возвращает исходную строку, если дата не разбирается', () => {
    expect(formatTimestamp('17 октября')).toBe('17 октября')
  })
})
