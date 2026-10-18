import { describe, expect, it } from 'vitest'
import { CRITERIA, CRITERIA_BY_CODE } from '../data/criteria'
import { SPECS, specIdFromFile } from '../data/spec-map'

describe('criteria', () => {
  it('имеет уникальные коды', () => {
    const codes = CRITERIA.map((criterion) => criterion.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('содержит базовые Б1–Б3 и дополнительный Д19', () => {
    expect(CRITERIA_BY_CODE.has('Б1')).toBe(true)
    expect(CRITERIA_BY_CODE.has('Б3')).toBe(true)
    expect(CRITERIA_BY_CODE.get('Д19')?.evaluation).toBe('static')
    expect(CRITERIA_BY_CODE.get('Д1')?.evaluation).toBe('model')
  })

  it('базовые критерии оцениваются Playwright', () => {
    for (const code of ['Б1', 'Б2', 'Б3']) {
      expect(CRITERIA_BY_CODE.get(code)?.evaluation).toBe('playwright')
    }
  })
})

describe('spec map', () => {
  it('разводит обязательные и необязательные сценарии', () => {
    expect(SPECS.filter((spec) => spec.criterion === 'Б1')).toHaveLength(9)
    expect(SPECS.filter((spec) => spec.criterion === 'Д1')).toHaveLength(1)
  })

  it('определяет id по пути файла', () => {
    expect(specIdFromFile('/x/src/specs/main-page.list.spec.ts')).toBe(
      'main-page.list',
    )
    expect(specIdFromFile('unknown.spec.ts')).toBeNull()
  })
})
