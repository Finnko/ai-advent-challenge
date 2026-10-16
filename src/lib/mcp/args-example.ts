import type { JsonValue } from './types'

type JsonObject = { [key: string]: JsonValue }

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value: JsonValue): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function sampleValue(schema: JsonValue): string {
  if (!isObject(schema)) {
    return '"<значение>"'
  }
  switch (schema.type) {
    case 'number':
    case 'integer':
      return '0'
    case 'boolean':
      return 'false'
    case 'array':
      return '[ "<значение>" ]'
    case 'object':
      return '{ ... }'
    default:
      return '"<строка>"'
  }
}

export function formatArgsExample(schema: JsonValue): string {
  if (!isObject(schema) || !isObject(schema.properties)) {
    return '{}'
  }
  const entries = Object.entries(schema.properties)
  if (entries.length === 0) {
    return '{}'
  }
  const body = entries
    .map(([name, value]) => `"${name}": ${sampleValue(value)}`)
    .join(', ')
  const required = stringList(schema.required)
  const suffix = required.length === 0 ? ' (все поля необязательны)' : ''
  return `{ ${body} }${suffix}`
}
