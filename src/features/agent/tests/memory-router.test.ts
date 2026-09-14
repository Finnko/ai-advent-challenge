import { describe, expect, it } from 'vitest'
import { MemoryRouter, routeMemories } from '../domain/memory/router'
import type { MemoryCandidate } from '../domain/memory/types'
import { MAX_MEMORY_VALUE_CHARS } from '../domain/memory/types'

describe('MemoryRouter', () => {
  it('берёт явный слой кандидата', () => {
    const entries = routeMemories({
      candidates: [
        { layer: 'long-term', key: 'Роль', value: 'отвечает за кофе' },
        { layer: 'working', key: 'Бюджет', value: '2 млн' },
      ],
      now: '2026-09-14T10:00:00.000Z',
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      layer: 'long-term',
      key: 'Роль',
      value: 'отвечает за кофе',
      source: 'auto',
      updatedAt: '2026-09-14T10:00:00.000Z',
    })
    expect(entries[1].layer).toBe('working')
  })

  it('размечает слой по категории, если он не указан', () => {
    const entries = routeMemories({
      candidates: [
        { key: 'Предпочтения по отчётам', value: 'коротко по пятницам' },
        { key: 'Цель запуска', value: 'вывести на рынок' },
      ],
    })

    expect(entries.find((e) => e.key === 'Предпочтения по отчётам')?.layer).toBe(
      'long-term',
    )
    expect(entries.find((e) => e.key === 'Цель запуска')?.layer).toBe('working')
  })

  it('пустой слой (null) уходит в fallback, а не отбрасывается', () => {
    const entries = routeMemories({
      candidates: [{ layer: null, key: 'Дедлайн', value: '3 месяца' }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].layer).toBe('working')
  })

  it('отбрасывает пустые ключи/значения, длинные значения и неизвестный слой', () => {
    const entries = routeMemories({
      candidates: [
        { key: '  ', value: 'x' },
        { key: 'k', value: '   ' },
        { key: 'k', value: 'x'.repeat(MAX_MEMORY_VALUE_CHARS + 1) },
        { layer: 'episodic' as never, key: 'k', value: 'v' },
      ],
    })
    expect(entries).toHaveLength(0)
  })

  it('дедуплицирует по нормализованному ключу, побеждает последний', () => {
    const candidates: MemoryCandidate[] = [
      { layer: 'working', key: 'Бюджет', value: '1 млн' },
      { layer: 'working', key: 'бюджет', value: '2 млн' },
    ]
    const entries = routeMemories({ candidates })
    expect(entries).toHaveLength(1)
    expect(entries[0].value).toBe('2 млн')
  })

  it('сохраняет разные слои под одинаковым ключом раздельно', () => {
    const entries = routeMemories({
      candidates: [
        { layer: 'working', key: 'решение', value: 'по задаче' },
        { layer: 'long-term', key: 'решение', value: 'по политике' },
      ],
    })
    expect(entries).toHaveLength(2)
  })

  it('проставляет source и scenario', () => {
    const entries = MemoryRouter.route({
      candidates: [{ layer: 'long-term', key: 'k', value: 'v' }],
      source: 'manual',
      scenario: 'Запуск',
      now: '2026-09-14T00:00:00.000Z',
    })
    expect(entries[0]).toMatchObject({
      source: 'manual',
      scenario: 'Запуск',
    })
  })
})
