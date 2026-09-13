import type { ChatMode } from '../day2'
import type { Tier } from '../llm'
import { TIER_IDS } from '../llm'
import { CONTEXT_STRATEGY_IDS } from '../context/registry'
import type { ContextStrategyId } from '../context/types'

export function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Некорректный запрос')
  }
  return input as Record<string, unknown>
}

export function requireText(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }
  return value.trim()
}

export function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string') {
    throw new Error(message)
  }
  return value
}

export function requireToken(value: unknown): string {
  return requireText(value, 'Токен обязателен')
}

export function requireUser(value: unknown): string {
  return requireText(value, 'Сообщение обязательно')
}

export function requireSessionId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Некорректный sessionId')
  }
  return value
}

export function requireNullableSessionId(value: unknown): number | null {
  if (value === null) {
    return null
  }
  return requireSessionId(value)
}

export function requireTier(value: unknown): Tier {
  if (!TIER_IDS.includes(value as Tier)) {
    throw new Error('Неизвестная ступень модели')
  }
  return value as Tier
}

export function requireChatMode(value: unknown): ChatMode {
  if (value !== 'free' && value !== 'constrained') {
    throw new Error('Неизвестный режим')
  }
  return value
}

export function requireStrategy(value: unknown): ContextStrategyId {
  if (!CONTEXT_STRATEGY_IDS.includes(value as ContextStrategyId)) {
    throw new Error('Неизвестная стратегия контекста')
  }
  return value as ContextStrategyId
}
