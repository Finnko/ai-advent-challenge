import { describe, expect, it } from 'vitest'
import {
  optionalProfileField,
  optionalProfileId,
  optionalScenario,
  requireBranchId,
  requireProfileName,
  requireStrategy,
} from './validation'

describe('agent validators', () => {
  it('распознаёт стратегии', () => {
    expect(requireStrategy('summary')).toBe('summary')
    expect(requireStrategy('none')).toBe('none')
    expect(requireStrategy('window')).toBe('window')
    expect(requireStrategy('facts')).toBe('facts')
    expect(requireStrategy('branch')).toBe('branch')
    expect(() => requireStrategy('unknown')).toThrow(
      'Неизвестная стратегия контекста',
    )
  })

  it('валидирует branchId', () => {
    expect(requireBranchId(3)).toBe(3)
    for (const bad of [0, -1, Number.NaN, '3', null]) {
      expect(() => requireBranchId(bad)).toThrow('Некорректный branchId')
    }
  })

  it('optionalScenario пропускает пустое и тримит', () => {
    expect(optionalScenario(undefined)).toBeNull()
    expect(optionalScenario(null)).toBeNull()
    expect(optionalScenario('  ')).toBeNull()
    expect(optionalScenario(' Собираем ТЗ ')).toBe('Собираем ТЗ')
    expect(() => optionalScenario(5)).toThrow('Некорректный сценарий')
  })

  it('валидирует имя профиля', () => {
    expect(requireProfileName('  Формальный  ')).toBe('Формальный')
    expect(() => requireProfileName('')).toThrow('Имя профиля обязательно')
    expect(() => requireProfileName('   ')).toThrow('Имя профиля обязательно')
    expect(() => requireProfileName(5)).toThrow('Имя профиля обязательно')
    expect(() => requireProfileName('a'.repeat(61))).toThrow(
      'Имя профиля длиннее 60 символов',
    )
  })

  it('optionalProfileId различает отсутствие, null и значение', () => {
    expect(optionalProfileId(undefined)).toBeUndefined()
    expect(optionalProfileId(null)).toBeNull()
    expect(optionalProfileId(3)).toBe(3)
    for (const bad of [0, -1, Number.NaN, '3']) {
      expect(() => optionalProfileId(bad)).toThrow('Некорректный profileId')
    }
  })

  it('optionalProfileField тримит, опустошает и ограничивает', () => {
    expect(optionalProfileField(undefined, 'tone')).toBeNull()
    expect(optionalProfileField('   ', 'tone')).toBeNull()
    expect(optionalProfileField(' деловой ', 'tone')).toBe('деловой')
    expect(() => optionalProfileField('a'.repeat(121), 'tone')).toThrow(
      'длиннее 120 символов',
    )
    expect(() => optionalProfileField('a'.repeat(1201), 'instructions')).toThrow(
      'длиннее 1200 символов',
    )
  })
})
