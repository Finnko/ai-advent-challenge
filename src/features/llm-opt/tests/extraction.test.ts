import { describe, expect, it } from 'vitest'
import { parseExtraction } from '../domain/extraction'

describe('parseExtraction', () => {
  it('разбирает чистый JSON и приводит числа', () => {
    const parsed = parseExtraction(
      '{"founded_year": 1147, "area_km2": "2561,5", "federal_district": "Центральный"}',
    )
    expect(parsed.format).toBe('json')
    expect(parsed.facts).toEqual({
      founded_year: 1147,
      area_km2: 2561.5,
      federal_district: 'Центральный',
    })
  })

  it('разбирает JSON в markdown-фенсах', () => {
    const parsed = parseExtraction(
      '```json\n{"founded_year": 1703, "area_km2": 1439, "federal_district": "Северо-Западный"}\n```',
    )
    expect(parsed.format).toBe('json')
    expect(parsed.facts?.founded_year).toBe(1703)
  })

  it('достаёт первый сбалансированный объект из прозы', () => {
    const parsed = parseExtraction(
      'Вот результат: {"founded_year": 1005, "area_km2": 589, "federal_district": "Приволжский"} — готово.',
    )
    expect(parsed.format).toBe('json')
    expect(parsed.facts?.area_km2).toBe(589)
  })

  it('оставляет null для отсутствующих полей', () => {
    const parsed = parseExtraction('{"founded_year": 1147}')
    expect(parsed.format).toBe('json')
    expect(parsed.facts?.founded_year).toBe(1147)
    expect(parsed.facts?.area_km2).toBeNull()
    expect(parsed.facts?.federal_district).toBeNull()
  })

  it('возвращает text без валидного JSON', () => {
    const parsed = parseExtraction('Не могу извлечь данные.')
    expect(parsed.format).toBe('text')
    expect(parsed.facts).toBeNull()
  })
})
