import { describe, expect, it } from 'vitest'
import { parseVerdicts, verdictsByCode } from '../domain/contract'
import {
  formatFindings,
  normalizeFinding,
  normalizeFindings,
} from '../domain/findings'
import { assembleResults } from '../domain/assemble'

describe('findings', () => {
  it('снимает маркер и нормализует пробелы', () => {
    expect(normalizeFinding('  - следует   переименовать ')).toBe(
      'следует переименовать',
    )
    expect(normalizeFinding('— надо исправить')).toBe('надо исправить')
  })

  it('отбрасывает пустые и дубликаты', () => {
    expect(normalizeFindings(['', '- a', 'a', '   '])).toEqual(['a'])
  })

  it('форматирует строки с дефисом', () => {
    expect(formatFindings(['a', 'b'])).toBe('- a\n- b')
  })

  it('приводит мягкий глагол к нижнему регистру', () => {
    expect(normalizeFinding('Следует переименовать массив')).toBe(
      'следует переименовать массив',
    )
    expect(normalizeFinding('В src/components лежат стили')).toBe(
      'В src/components лежат стили',
    )
  })
})

describe('parseVerdicts', () => {
  it('читает JSON из ограждения', () => {
    const verdicts = parseVerdicts(
      'ответ:\n```json\n{"verdicts":[{"code":"Д3","status":"fail","findings":["- следует собрать константы"]}]}\n```',
    )
    expect(verdicts).toHaveLength(1)
    expect(verdicts[0]).toMatchObject({ code: 'Д3', status: 'fail' })
    expect(verdicts[0].findings).toEqual(['следует собрать константы'])
  })

  it('переживает мусор', () => {
    expect(parseVerdicts('не json')).toEqual([])
    expect(parseVerdicts('{"verdicts":[{"code":"","status":"fail"}]}')).toEqual(
      [],
    )
  })

  it('строит индекс по коду', () => {
    const map = verdictsByCode(
      parseVerdicts('{"verdicts":[{"code":"Д5","status":"pass"}]}'),
    )
    expect(map.get('Д5')?.status).toBe('pass')
  })
})

describe('assembleResults', () => {
  const at = '2026-01-01T00:00:00.000Z'

  it('возвращает вердикт на каждый критерий', () => {
    const results = assembleResults({
      at,
      playwright: null,
      static: [],
      model: [],
      explanations: [],
    })
    expect(results.length).toBeGreaterThan(20)
    expect(results.every((result) => result.status === 'not_checked')).toBe(
      true,
    )
  })

  it('подставляет замечания модели к проваленному Б1', () => {
    const results = assembleResults({
      at,
      playwright: [
        {
          code: 'Б1',
          status: 'fail',
          reason: 'не прошло',
          evidence: ['main-page — сортировка'],
        },
      ],
      static: [],
      model: [],
      explanations: [
        {
          code: 'Б1',
          status: null,
          reason: 'Сортировка не работает.',
          findings: ['следует починить сортировку'],
        },
      ],
    })
    const basic = results.find((result) => result.code === 'Б1')
    expect(basic?.status).toBe('fail')
    expect(basic?.findings).toEqual(['следует починить сортировку'])
    expect(basic?.reason).toBe('Сортировка не работает.')
  })

  it('берёт статус модельного критерия из вердикта', () => {
    const results = assembleResults({
      at,
      playwright: [],
      static: [],
      model: [
        {
          code: 'Д14',
          status: 'fail',
          reason: 'есть эффекты',
          findings: ['следует убрать эффекты из редьюсера'],
        },
      ],
      explanations: [],
    })
    const redux = results.find((result) => result.code === 'Д14')
    expect(redux?.status).toBe('fail')
    expect(redux?.findings).toEqual(['следует убрать эффекты из редьюсера'])
  })
})
