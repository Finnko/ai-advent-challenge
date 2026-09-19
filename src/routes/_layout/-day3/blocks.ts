import {
  EXPERT_ROLES,
  HELPFUL_SYSTEM,
  PROMPT_ENGINEER_SYSTEM,
  STEPWISE_SYSTEM,
} from '@lib/day3'
import type { ExpertId, StrategyId } from '@lib/day3'
import type { SentBlock, StrategyResult } from './types'

export function previewBlocks(id: StrategyId, prompt: string): SentBlock[] {
  switch (id) {
    case 'direct':
      return [
        { label: 'system', text: HELPFUL_SYSTEM },
        { label: 'user', text: prompt },
      ]
    case 'stepwise':
      return [
        { label: 'system', text: STEPWISE_SYSTEM },
        { label: 'user', text: prompt },
      ]
    case 'promptcraft':
      return [
        { label: 'шаг 1 · system', text: PROMPT_ENGINEER_SYSTEM },
        { label: 'шаг 1 · user', text: prompt },
        { label: 'шаг 2 · system', text: HELPFUL_SYSTEM },
        {
          label: 'шаг 2 · user',
          text: 'Сгенерированный промпт — появится после шага 1.',
        },
      ]
    case 'expert':
      return EXPERT_ROLES.flatMap((role) => [
        { label: `${role.label} · system`, text: role.system },
        { label: `${role.label} · user`, text: prompt },
      ])
  }
}

export function sentBlocks(
  result: StrategyResult,
  expertId?: ExpertId,
): SentBlock[] {
  const { promptUsed } = result
  switch (result.kind) {
    case 'answer':
      return [
        { label: 'system', text: HELPFUL_SYSTEM },
        { label: 'user', text: promptUsed },
      ]
    case 'promptcraft':
      return [
        { label: 'call 1 · system', text: PROMPT_ENGINEER_SYSTEM },
        { label: 'call 1 · user', text: promptUsed },
        { label: 'call 2 · system', text: HELPFUL_SYSTEM },
        { label: 'call 2 · user', text: result.composed.content },
      ]
    case 'experts': {
      const role = EXPERT_ROLES.find((r) => r.id === expertId)
      if (role) {
        return [
          { label: `${role.label} · system`, text: role.system },
          { label: `${role.label} · user`, text: promptUsed },
        ]
      }
      return EXPERT_ROLES.flatMap((role) => [
        { label: `${role.label} · system`, text: role.system },
        { label: `${role.label} · user`, text: promptUsed },
      ])
    }
  }
}
