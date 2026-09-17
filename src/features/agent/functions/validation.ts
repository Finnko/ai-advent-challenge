export {
  asObject,
  requireNullableSessionId,
  requireSessionId,
  requireString,
  requireText,
  requireToken,
  requireUser,
} from '@lib/functions/validation'

import { asObject } from '@lib/functions/validation'

import { CONTEXT_STRATEGY_IDS } from '../domain/context/registry'
import type { ContextStrategyId } from '../domain/context/types'
import { isMemoryLayer } from '../domain/memory/read'
import type { MemoryLayer } from '../domain/memory/types'
import { MAX_MEMORY_VALUE_CHARS } from '../domain/memory/types'
import type { ProfileField, ProfileInput } from '../domain/profile/types'
import { PROFILE_NAME_MAX, profileFieldMax } from '../domain/profile/types'

export const WINDOW_SIZE_MIN = 2
export const WINDOW_SIZE_MAX = 50

export function requireWindowSize(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < WINDOW_SIZE_MIN ||
    value > WINDOW_SIZE_MAX
  ) {
    throw new Error(
      `Некорректный размер окна: нужно целое от ${WINDOW_SIZE_MIN} до ${WINDOW_SIZE_MAX}`,
    )
  }
  return value
}

export function optionalWindowSize(value: unknown): number {
  if (value === undefined || value === null) {
    return 10
  }
  return requireWindowSize(value)
}

export function optionalBoolean(
  value: unknown,
  fallback = false,
): boolean {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value !== 'boolean') {
    throw new Error('Ожидалось булево значение')
  }
  return value
}

export function optionalInvariantSetId(
  value: unknown,
): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Некорректный invariantSetId')
  }
  return value
}

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

export function requireProfileId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Некорректный profileId')
  }
  return value
}

export function optionalProfileId(
  value: unknown,
): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return requireProfileId(value)
}

export function requireProfileName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Имя профиля обязательно')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('Имя профиля обязательно')
  }
  if (trimmed.length > PROFILE_NAME_MAX) {
    throw new Error(`Имя профиля длиннее ${PROFILE_NAME_MAX} символов`)
  }
  return trimmed
}

export function optionalProfileField(
  value: unknown,
  field: ProfileField,
): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error('Некорректное значение поля профиля')
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  const max = profileFieldMax(field)
  if (trimmed.length > max) {
    throw new Error(`Значение поля «${field}» длиннее ${max} символов`)
  }
  return trimmed
}

export function requireProfileInput(value: unknown): ProfileInput {
  const data = asObject(value)
  return {
    name: requireProfileName(data.name),
    addressing: optionalProfileField(data.addressing, 'addressing'),
    tone: optionalProfileField(data.tone, 'tone'),
    language: optionalProfileField(data.language, 'language'),
    verbosity: optionalProfileField(data.verbosity, 'verbosity'),
    format: optionalProfileField(data.format, 'format'),
    constraints: optionalProfileField(data.constraints, 'constraints'),
    instructions: optionalProfileField(data.instructions, 'instructions'),
  }
}
