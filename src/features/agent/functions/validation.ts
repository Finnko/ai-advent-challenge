export {
  asObject,
  requireNullableSessionId,
  requireSessionId,
  requireString,
  requireText,
  requireToken,
  requireUser,
} from '@lib/functions/validation'

import { CONTEXT_STRATEGY_IDS } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'
import { isMemoryLayer } from '../domain/memory/read'
import type { MemoryLayer } from '../domain/memory/types'
import { MAX_MEMORY_VALUE_CHARS } from '../domain/memory/types'

export function requireBranchId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Некорректный branchId')
  }
  return value
}

export function optionalScenario(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error('Некорректный сценарий')
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function requireStrategy(value: unknown): ContextStrategyId {
  if (!CONTEXT_STRATEGY_IDS.includes(value as ContextStrategyId)) {
    throw new Error('Неизвестная стратегия контекста')
  }
  return value as ContextStrategyId
}

export function requireMemoryLayer(value: unknown): MemoryLayer {
  if (!isMemoryLayer(value)) {
    throw new Error('Неизвестный слой памяти')
  }
  return value
}

export function requireMemoryValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Некорректный текст памяти')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('Пустое значение памяти')
  }
  if (trimmed.length > MAX_MEMORY_VALUE_CHARS) {
    throw new Error(`Значение памяти длиннее ${MAX_MEMORY_VALUE_CHARS} символов`)
  }
  return trimmed
}
