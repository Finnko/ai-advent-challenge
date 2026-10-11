export type FederalDistrict =
  | 'Центральный'
  | 'Северо-Западный'
  | 'Южный'
  | 'Северо-Кавказский'
  | 'Приволжский'
  | 'Уральский'
  | 'Сибирский'
  | 'Дальневосточный'

export const FEDERAL_DISTRICTS: FederalDistrict[] = [
  'Центральный',
  'Северо-Западный',
  'Южный',
  'Северо-Кавказский',
  'Приволжский',
  'Уральский',
  'Сибирский',
  'Дальневосточный',
]

export type FieldId = 'founded_year' | 'area_km2' | 'federal_district'

export const FIELD_IDS: FieldId[] = [
  'founded_year',
  'area_km2',
  'federal_district',
]

export const FIELD_LABELS: Record<FieldId, string> = {
  founded_year: 'год основания',
  area_km2: 'площадь, км²',
  federal_district: 'федеральный округ',
}

export type ExtractionGold = {
  founded_year: number
  area_km2: number
  federal_district: FederalDistrict
}

export type ExtractedFacts = {
  founded_year: number | null
  area_km2: number | null
  federal_district: string | null
}

export type ParsedExtraction = {
  facts: ExtractedFacts | null
  format: 'json' | 'text'
}

function stripFences(content: string): string {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fence ? fence[1] : content
}

function firstBalancedObject(content: string): string | null {
  const start = content.indexOf('{')
  if (start < 0) {
    return null
  }
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return content.slice(start, index + 1)
      }
    }
  }
  return null
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  if (cleaned.length === 0) {
    return null
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function toText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

function coerceFacts(raw: unknown): ExtractedFacts | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const record = raw as Record<string, unknown>
  return {
    founded_year: toNumber(record.founded_year),
    area_km2: toNumber(record.area_km2),
    federal_district: toText(record.federal_district),
  }
}

export function parseExtraction(content: string): ParsedExtraction {
  const block = firstBalancedObject(stripFences(content))
  if (block === null) {
    return { facts: null, format: 'text' }
  }
  try {
    const facts = coerceFacts(JSON.parse(block))
    if (facts === null) {
      return { facts: null, format: 'text' }
    }
    return { facts, format: 'json' }
  } catch {
    return { facts: null, format: 'text' }
  }
}
