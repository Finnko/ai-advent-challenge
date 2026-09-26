import { describe, expect, it } from 'vitest'
import { findCity } from '../domain/jobs/cities'

describe('findCity', () => {
  it('принимает Санкт-Петербург в разных написаниях', () => {
    const inputs = [
      'Санкт-Петербург',
      'Санкт Петербург',
      'санкт  петербург',
      'СПб',
      'Питер',
    ]
    for (const input of inputs) {
      expect(findCity(input)?.id, input).toBe('spb')
    }
  })

  it('принимает Москву и неизвестный город отклоняет', () => {
    expect(findCity('Москва')?.id).toBe('moscow')
    expect(findCity('Казань')).toBeNull()
    expect(findCity(42)).toBeNull()
  })
})
