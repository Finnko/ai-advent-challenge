import { describe, expect, it } from 'vitest'
import { parseStartReviewInput } from '../functions/validation'

describe('parseStartReviewInput', () => {
  it('принимает zip-архив', () => {
    expect(parseStartReviewInput({ key: 'ivan', zipBase64: 'abc' })).toEqual({
      key: 'ivan',
      zipBase64: 'abc',
      sourcePath: null,
      resumedFrom: null,
    })
  })

  it('принимает путь к распакованному проекту без архива', () => {
    const parsed = parseStartReviewInput({
      key: 'ivan',
      sourcePath: '/Users/me/project',
    })
    expect(parsed.sourcePath).toBe('/Users/me/project')
    expect(parsed.zipBase64).toBe('')
  })

  it('требует архив или путь', () => {
    expect(() => parseStartReviewInput({ key: 'ivan' })).toThrow(
      /архив или путь/i,
    )
    expect(() =>
      parseStartReviewInput({ key: 'ivan', zipBase64: '   ' }),
    ).toThrow(/архив или путь/i)
  })

  it('требует ключ проекта', () => {
    expect(() => parseStartReviewInput({ zipBase64: 'abc' })).toThrow(/ключ/i)
  })

  it('пробрасывает resumedFrom', () => {
    expect(
      parseStartReviewInput({ key: 'ivan', sourcePath: '/p', resumedFrom: 3 })
        .resumedFrom,
    ).toBe(3)
  })
})
