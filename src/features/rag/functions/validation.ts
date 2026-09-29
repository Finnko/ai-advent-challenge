import { asObject, requireText } from '@lib/functions/validation'
import { isChunkingStrategyId } from '../domain/chunking/registry'
import type { ChunkingStrategyId } from '../domain/types'

export function requireChunkingStrategy(value: unknown): ChunkingStrategyId {
  if (!isChunkingStrategyId(value)) {
    throw new Error('Неизвестная стратегия чанкинга')
  }
  return value
}

export function requireQuery(value: unknown): string {
  const query = requireText(value, 'Запрос обязателен')
  if (query.length > 500) {
    throw new Error('Запрос длиннее 500 символов')
  }
  return query
}

export function optionalK(value: unknown): number {
  if (value === undefined || value === null) {
    return 5
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 20
  ) {
    throw new Error('k должно быть целым от 1 до 20')
  }
  return value
}

export function parseBuildInput(value: unknown): ChunkingStrategyId | 'all' {
  const data = asObject(value)
  if (data.strategy === 'all') {
    return 'all'
  }
  return requireChunkingStrategy(data.strategy)
}
