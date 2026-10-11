import { describe, expect, it } from 'vitest'
import {
  canonicalDistrict,
  canonicalNumber,
  gradeExtraction,
} from '../domain/metric'

const GOLD = {
  founded_year: 1147,
  area_km2: 2561.5,
  federal_district: 'Центральный' as const,
}

describe('canonicalDistrict', () => {
  it('сводит полное название округа к канону', () => {
    expect(canonicalDistrict('Центральный федеральный округ')).toBe(
      'Центральный',
    )
  })

  it('не зависит от регистра и ё', () => {
    expect(canonicalDistrict('СЕВЕРО-ЗАПАДНЫЙ')).toBe('Северо-Западный')
  })

  it('возвращает пустую строку для null', () => {
    expect(canonicalDistrict(null)).toBe('')
  })
})

describe('canonicalNumber', () => {
  it('приводит число к строке без хвостовых нулей', () => {
    expect(canonicalNumber(2561.5)).toBe('2561.5')
    expect(canonicalNumber(1147)).toBe('1147')
  })

  it('возвращает пустую строку для null', () => {
    expect(canonicalNumber(null)).toBe('')
  })
})

describe('gradeExtraction', () => {
  it('считает полностью верный ответ', () => {
    const graded = gradeExtraction(GOLD, {
      founded_year: 1147,
      area_km2: 2561.5,
      federal_district: 'Центральный федеральный округ',
    })
    expect(graded.score).toBe(1)
    expect(graded.valid).toBe(true)
  })

  it('считает частичный ответ и находит промах', () => {
    const graded = gradeExtraction(GOLD, {
      founded_year: 2025,
      area_km2: 2561.5,
      federal_district: 'Центральный',
    })
    expect(graded.score).toBeCloseTo(2 / 3)
    expect(graded.valid).toBe(false)
    const year = graded.fields.find((field) => field.field === 'founded_year')
    expect(year?.correct).toBe(false)
  })

  it('штрафует отсутствие ответа', () => {
    const graded = gradeExtraction(GOLD, null)
    expect(graded.score).toBe(0)
    expect(graded.valid).toBe(false)
  })
})
