import { branchStrategy } from './branch'
import { factsStrategy } from './facts'
import { noneStrategy } from './none'
import { summaryStrategy } from './summary'
import type { ContextStrategy, ContextStrategyId } from './types'
import { windowStrategy } from './window'

export const CONTEXT_STRATEGIES: Record<ContextStrategyId, ContextStrategy> = {
  summary: summaryStrategy,
  none: noneStrategy,
  window: windowStrategy,
  facts: factsStrategy,
  branch: branchStrategy,
}

export const CONTEXT_STRATEGY_IDS = Object.keys(
  CONTEXT_STRATEGIES,
) as ContextStrategyId[]

export function resolveStrategy(id: ContextStrategyId): ContextStrategy {
  const strategy = CONTEXT_STRATEGIES[id]
  if (!strategy) {
    throw new Error(`Неизвестная стратегия контекста: ${id}`)
  }
  return strategy
}
