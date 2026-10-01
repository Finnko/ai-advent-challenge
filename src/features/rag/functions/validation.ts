import { asObject, requireText } from '@lib/functions/validation'
import { isChunkingStrategyId } from '../domain/chunking/registry'
import { isRagPipelineId, type RagPipelineId } from '../domain/pipelines'
import type { AnswerMode, ChunkingStrategyId } from '../domain/types'

export function requireChunkingStrategy(value: unknown): ChunkingStrategyId {
  if (!isChunkingStrategyId(value)) {
    throw new Error('Неизвестная стратегия чанкинга')
  }
  return value
}

export function requireAnswerMode(value: unknown): AnswerMode {
  if (value !== 'rag' && value !== 'baseline') {
    throw new Error('Неизвестный режим ответа')
  }
  return value
}

export function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!Array.isArray(value)) {
    throw new Error('Ожидался список строк')
  }
  return value.map((item) =>
    requireText(item, 'Некорректное значение в списке'),
  )
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

export function optionalBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value !== 'boolean') {
    throw new Error('Ожидалось логическое значение')
  }
  return value
}

export function optionalCandidateK(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    throw new Error('candidateK должно быть целым от 1 до 100')
  }
  return value
}

export function optionalThreshold(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error('Порог должен быть числом от 0 до 1')
  }
  return value
}

export function optionalRagPipeline(
  value: unknown,
  fallback: RagPipelineId,
): RagPipelineId {
  if (value === undefined || value === null) {
    return fallback
  }
  if (!isRagPipelineId(value)) {
    throw new Error('Неизвестный режим RAG')
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
