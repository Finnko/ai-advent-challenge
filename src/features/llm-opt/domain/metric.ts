import {
  FEDERAL_DISTRICTS,
  FIELD_IDS,
  type ExtractedFacts,
  type ExtractionGold,
  type FieldId,
} from './extraction'

export type FieldResult = {
  field: FieldId
  expected: string
  actual: string
  correct: boolean
}

export type GradedExtraction = {
  fields: FieldResult[]
  score: number
  valid: boolean
}

function normalizeSpace(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')
}

export function canonicalDistrict(value: string | null): string {
  if (value === null) {
    return ''
  }
  const normalized = normalizeSpace(value)
  const hit = FEDERAL_DISTRICTS.find((district) =>
    normalized.includes(normalizeSpace(district)),
  )
  return hit ?? normalized
}

export function canonicalNumber(value: number | null): string {
  if (value === null) {
    return ''
  }
  return String(Math.round(value * 1000) / 1000)
}

function expectedValue(gold: ExtractionGold, field: FieldId): string {
  if (field === 'founded_year') {
    return canonicalNumber(gold.founded_year)
  }
  if (field === 'area_km2') {
    return canonicalNumber(gold.area_km2)
  }
  return canonicalDistrict(gold.federal_district)
}

function actualValue(facts: ExtractedFacts, field: FieldId): string {
  if (field === 'founded_year') {
    return canonicalNumber(facts.founded_year)
  }
  if (field === 'area_km2') {
    return canonicalNumber(facts.area_km2)
  }
  return canonicalDistrict(facts.federal_district)
}

export function gradeExtraction(
  gold: ExtractionGold,
  facts: ExtractedFacts | null,
): GradedExtraction {
  if (facts === null) {
    return {
      fields: FIELD_IDS.map((field) => ({
        field,
        expected: expectedValue(gold, field),
        actual: '',
        correct: false,
      })),
      score: 0,
      valid: false,
    }
  }
  const fields = FIELD_IDS.map((field) => {
    const expected = expectedValue(gold, field)
    const actual = actualValue(facts, field)
    return {
      field,
      expected,
      actual,
      correct: expected !== '' && expected === actual,
    }
  })
  const correct = fields.filter((field) => field.correct).length
  return {
    fields,
    score: correct / fields.length,
    valid: correct === fields.length,
  }
}
