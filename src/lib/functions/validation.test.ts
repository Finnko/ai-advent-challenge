import { describe, expect, it } from 'vitest'
import {
  asObject,
  requireChatMode,
  requireNullableSessionId,
  requireSessionId,
  requireStrategy,
  requireString,
  requireText,
  requireTier,
  requireToken,
} from './validation'

describe('asObject', () => {
  it('пропускает объект и отклоняет null/примитивы', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 })
    expect(() => asObject(null)).toThrow('Некорректный запрос')
    expect(() => asObject('str')).toThrow('Некорректный запрос')
    expect(() => asObject(42)).toThrow('Некорректный запрос')
  })
})

describe('requireText / requireString', () => {
  it('требует непустую строку и тримит', () => {
    expect(requireText('  привет ', 'bad')).toBe('привет')
    expect(() => requireText('   ', 'Промпт обязателен')).toThrow(
      'Промпт обязателен',
    )
    expect(() => requireText(5, 'Промпт обязателен')).toThrow(
      'Промпт обязателен',
    )
  })

  it('requireString допускает пустую строку, но не другие типы', () => {
    expect(requireString('', 'bad')).toBe('')
    expect(() => requireString(null, 'bad')).toThrow('bad')
  })
})

describe('requireToken / requireUser', () => {
  it('валидирует токен и сообщение', () => {
    expect(requireToken(' tok ')).toBe('tok')
    expect(() => requireToken('')).toThrow('Токен обязателен')
    expect(requireText(' hi ', 'Сообщение обязательно')).toBe('hi')
  })
})

describe('requireSessionId / requireNullableSessionId', () => {
  it('принимает положительные числа', () => {
    expect(requireSessionId(3)).toBe(3)
  })

  it('отклоняет не-числа, ноль и отрицательные', () => {
    for (const bad of [0, -1, Number.NaN, '3', null]) {
      expect(() => requireSessionId(bad)).toThrow('Некорректный sessionId')
    }
  })

  it('nullable пропускает null', () => {
    expect(requireNullableSessionId(null)).toBeNull()
    expect(requireNullableSessionId(7)).toBe(7)
    expect(() => requireNullableSessionId(undefined)).toThrow(
      'Некорректный sessionId',
    )
  })
})

describe('requireTier / requireChatMode / requireStrategy', () => {
  it('распознаёт известные значения', () => {
    expect(requireTier('weak')).toBe('weak')
    expect(requireChatMode('constrained')).toBe('constrained')
    expect(requireStrategy('summary')).toBe('summary')
    expect(requireStrategy('none')).toBe('none')
  })

  it('отклоняет неизвестные значения', () => {
    expect(() => requireTier('huge')).toThrow('Неизвестная ступень модели')
    expect(() => requireChatMode('json')).toThrow('Неизвестный режим')
    expect(() => requireStrategy('window')).toThrow(
      'Неизвестная стратегия контекста',
    )
  })
})
