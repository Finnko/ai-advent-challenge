import { branchStrategy } from './branch'
import { createFactsStrategy } from './facts'
import { noneStrategy } from './none'
import { createSummaryStrategy } from './summary'
import type {
  ContextCapabilities,
  ContextStrategy,
  ContextStrategyId,
} from './types'
import { windowStrategy } from './window'

export const CONTEXT_STRATEGIES: Record<
  ContextStrategyId,
  { label: string; description: string }
> = {
  summary: {
    label: 'Сжатие истории',
    description:
      'Старые ходы сворачиваются в сводку; в запрос уходят последние сообщения и сводка.',
  },
  none: {
    label: 'Без сжатия',
    description: 'Вся история ветки уходит в запрос как есть.',
  },
  window: {
    label: 'Скользящее окно',
    description:
      'В запрос уходят только последние сообщения, старое отбрасывается без следа.',
  },
  facts: {
    label: 'Факты (key-value)',
    description:
      'Важные факты обновляются после каждого хода; в запрос уходят факты и последние сообщения.',
  },
  branch: {
    label: 'Ветки диалога',
    description:
      'В запрос уходит активная ветка от checkpoint; переключение ветки меняет историю.',
  },
}

export const CONTEXT_STRATEGY_IDS = Object.keys(
  CONTEXT_STRATEGIES,
) as ContextStrategyId[]

const STRATEGY_FACTORIES: Record<
  ContextStrategyId,
  (capabilities: ContextCapabilities) => ContextStrategy
> = {
  summary: (capabilities) => createSummaryStrategy(capabilities.summary),
  none: () => noneStrategy,
  window: () => windowStrategy,
  facts: (capabilities) => createFactsStrategy(capabilities.facts),
  branch: () => branchStrategy,
}

export function resolveStrategy(
  id: ContextStrategyId,
  capabilities: ContextCapabilities,
): ContextStrategy {
  const factory = STRATEGY_FACTORIES[id]
  if (!factory) {
    throw new Error(`Неизвестная стратегия контекста: ${id}`)
  }
  return factory(capabilities)
}
