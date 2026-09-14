import { describe, expect, it } from 'vitest'
import {
  applyLongTermLimit,
  buildMemoryBlocks,
  formatMemoryBlock,
  isMemoryLayer,
  memorySourceLabel,
  mergeMemoryEntries,
} from '../domain/memory/read'
import type { MemoryEntry, MemoryLayer } from '../domain/memory/types'

function entry(
  layer: MemoryLayer,
  key: string,
  value: string,
  overrides: Partial<MemoryEntry> = {},
): MemoryEntry {
  return {
    layer,
    key,
    value,
    source: 'auto',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('isMemoryLayer', () => {
  it('распознаёт только рабочий и долговременный слои', () => {
    expect(isMemoryLayer('working')).toBe(true)
    expect(isMemoryLayer('long-term')).toBe(true)
    expect(isMemoryLayer('short-term')).toBe(false)
    expect(isMemoryLayer(42)).toBe(false)
  })
})

describe('mergeMemoryEntries', () => {
  it('авто-запись перезаписывает авто по нормализованному ключу', () => {
    const merged = mergeMemoryEntries(
      [entry('working', 'Бюджет', '1 млн')],
      [entry('working', 'бюджет', '2 млн')],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].value).toBe('2 млн')
  })

  it('ручная запись не перетирается авто', () => {
    const merged = mergeMemoryEntries(
      [entry('long-term', 'Предпочтение', 'коротко', { source: 'manual' })],
      [entry('long-term', 'предпочтение', 'подробно')],
    )
    expect(merged[0]).toMatchObject({
      value: 'коротко',
      source: 'manual',
    })
  })

  it('ручная запись перетирает любую', () => {
    const merged = mergeMemoryEntries(
      [entry('long-term', 'Предпочтение', 'коротко')],
      [entry('long-term', 'Предпочтение', 'подробно', { source: 'manual' })],
    )
    expect(merged[0].value).toBe('подробно')
  })

  it('держит одинаковые ключи разных слоёв раздельно', () => {
    const merged = mergeMemoryEntries(
      [entry('working', 'Решение', 'по задаче')],
      [entry('long-term', 'Решение', 'по политике')],
    )
    expect(merged).toHaveLength(2)
  })
})

describe('applyLongTermLimit', () => {
  it('вытесняет самые старые записи сверх лимита', () => {
    const entries = [
      entry('long-term', 'a', '1', { updatedAt: '2026-01-01T00:00:00.000Z' }),
      entry('long-term', 'b', '2', { updatedAt: '2026-03-01T00:00:00.000Z' }),
      entry('long-term', 'c', '3', { updatedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const limited = applyLongTermLimit(entries, 2)
    expect(limited.map((e) => e.key)).toEqual(['b', 'c'])
  })

  it('не трогает список в пределах лимита', () => {
    const entries = [entry('long-term', 'a', '1')]
    expect(applyLongTermLimit(entries, 5)).toBe(entries)
  })
})

describe('buildMemoryBlocks', () => {
  it('пустые слои не дают блоков', () => {
    expect(buildMemoryBlocks({ working: [], longTerm: [] })).toEqual([])
  })

  it('порядок блоков: долговременный, затем рабочая память', () => {
    const blocks = buildMemoryBlocks({
      working: [entry('working', 'Цель', 'запуск')],
      longTerm: [entry('long-term', 'Роль', 'кофе')],
    })
    expect(blocks.map((b) => b.kind)).toEqual(['long-term', 'working'])
    expect(blocks[0].content).toContain('ДОЛГОВРЕМЕННАЯ ПАМЯТЬ')
    expect(blocks[0].content).toContain('Роль: кофе')
    expect(blocks[1].content).toContain('РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ')
  })

  it('пропускает пустой слой, оставляя непустой', () => {
    const blocks = buildMemoryBlocks({
      working: [],
      longTerm: [entry('long-term', 'k', 'v')],
    })
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('long-term')
  })
})

describe('formatMemoryBlock / memorySourceLabel', () => {
  it('пустой список даёт пустую строку', () => {
    expect(formatMemoryBlock('working', [])).toBe('')
  })

  it('подписывает источник', () => {
    expect(memorySourceLabel('manual')).toBe('вручную')
    expect(memorySourceLabel('auto')).toBe('авто')
  })
})
