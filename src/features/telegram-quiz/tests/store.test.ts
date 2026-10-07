import { describe, expect, it } from 'vitest'
import { RoundStore } from '../domain/store'
import { createRound } from '../domain/round'
import type { Topic } from '../domain/types'

const TOPIC: Topic = { id: 'it', label: 'IT', prompt: 'технологии' }

function round(chatId: number) {
  return createRound({
    chatId,
    roundId: `r-${chatId}`,
    topic: TOPIC,
    difficulty: 'medium',
  })
}

describe('RoundStore', () => {
  it('хранит и отдаёт состояние по чату', () => {
    const store = new RoundStore()
    store.set(round(1))
    expect(store.get(1)?.roundId).toBe('r-1')
  })

  it('изолирует чаты', () => {
    const store = new RoundStore()
    store.set(round(1))
    store.set(round(2))
    expect(store.get(1)?.chatId).toBe(1)
    expect(store.get(2)?.chatId).toBe(2)
  })

  it('удаляет состояние', () => {
    const store = new RoundStore()
    store.set(round(1))
    store.delete(1)
    expect(store.get(1)).toBeUndefined()
  })

  it('выбрасывает просроченные раунды', () => {
    const store = new RoundStore(1000)
    const stale = round(1)
    stale.updatedAt = Date.now() - 5000
    store.set(stale)
    expect(store.get(1)).toBeUndefined()
  })

  it('не выбрасывает свежие раунды', () => {
    const store = new RoundStore(60_000)
    store.set(round(1))
    expect(store.get(1)).toBeDefined()
  })
})
