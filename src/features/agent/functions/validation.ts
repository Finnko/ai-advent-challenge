export {
  asObject,
  requireNullableSessionId,
  requireSessionId,
  requireString,
  requireText,
  requireToken,
  requireUser,
} from '../../../lib/functions/validation'

import { CONTEXT_STRATEGY_IDS } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'

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
