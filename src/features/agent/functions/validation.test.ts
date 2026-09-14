import { describe, expect, it } from 'vitest'
import {
  optionalScenario,
  requireBranchId,
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
})
