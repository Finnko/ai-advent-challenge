import { describe, expect, it } from 'vitest'
import {
  optionalBoolean,
  optionalInvariantSetId,
  optionalProfileField,
  optionalProfileId,
  optionalScenario,
  optionalWindowSize,
  requireBranchId,
  requireInvariantInput,
  requireInvariantUpdate,
  requireProfileName,
  requireStrategy,
  requireWindowSize,
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

  it('валидирует размер скользящего окна', () => {
    expect(requireWindowSize(2)).toBe(2)
    expect(requireWindowSize(50)).toBe(50)
    for (const bad of [1, 51, 3.5, Number.NaN, '10', null]) {
      expect(() => requireWindowSize(bad)).toThrow('Некорректный размер окна')
    }
    expect(optionalWindowSize(undefined)).toBe(10)
    expect(optionalWindowSize(null)).toBe(10)
    expect(optionalWindowSize(4)).toBe(4)
  })

  it('optionalBoolean и optionalInvariantSetId различают отсутствие и null', () => {
    expect(optionalBoolean(undefined)).toBe(false)
    expect(optionalBoolean(true)).toBe(true)
    expect(optionalBoolean(null, true)).toBe(true)
    expect(() => optionalBoolean('true')).toThrow('Ожидалось булево значение')

    expect(optionalInvariantSetId(undefined)).toBeUndefined()
    expect(optionalInvariantSetId(null)).toBeNull()
    expect(optionalInvariantSetId(7)).toBe(7)
    expect(() => optionalInvariantSetId(0)).toThrow('Некорректный invariantSetId')
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

  it('разделяет create/update input инварианта', () => {
    expect(requireInvariantInput({ slug: 'rule', category: 'business', title: 'Правило', text: 'Текст' })).toMatchObject({ slug: 'rule' })
    expect(requireInvariantUpdate({ category: 'business', title: 'Правило', text: 'Текст', slug: 'ignored' })).not.toHaveProperty('slug')
    expect(() => requireInvariantInput({ slug: 'bad slug', category: 'business', title: 'Правило', text: 'Текст' })).toThrow('Некорректный slug')
    expect(() => requireInvariantUpdate({ category: 'business', title: '', text: 'Текст' })).toThrow('Название инварианта')
    expect(() => requireInvariantUpdate({ category: 'security', title: 'Правило', text: 'Текст' })).toThrow('Некорректная категория')
  })
})
