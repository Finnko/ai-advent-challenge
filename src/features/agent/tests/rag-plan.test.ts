import { describe, expect, it, vi } from 'vitest'
import { isLiveRequest, planRagQuery } from '../domain/rag/plan'

describe('isLiveRequest', () => {
  it('распознаёт запросы про живые данные', () => {
    expect(isLiveRequest('Какая погода там сегодня?')).toBe(true)
    expect(isLiveRequest('Покажи пробки сейчас')).toBe(true)
    expect(isLiveRequest('Какой курс доллара сегодня?')).toBe(true)
    expect(isLiveRequest('Прогноз на выходные')).toBe(true)
  })

  it('не трогает знаниевые вопросы', () => {
    expect(isLiveRequest('Расскажи про Казань')).toBe(false)
    expect(isLiveRequest('Когда основана Казань?')).toBe(false)
    expect(isLiveRequest('Какой климат в Москве?')).toBe(false)
    expect(
      isLiveRequest('Назови точный номер телефона приёмной мэрии Казани.'),
    ).toBe(false)
  })
})

describe('planRagQuery', () => {
  it('на живой запрос возвращает live и не зовёт rewrite', async () => {
    const rewrite = vi.fn(async () => 'переформулировано')
    const plan = await planRagQuery({
      query: 'Какая погода там сегодня?',
      rewrite,
    })
    expect(plan).toEqual({ kind: 'live' })
    expect(rewrite).not.toHaveBeenCalled()
  })

  it('раскрывает follow-up через rewrite с историей', async () => {
    const seen: string[] = []
    const plan = await planRagQuery({
      query: 'Кто основал более молодой из этих городов?',
      history: [
        { role: 'user', content: 'Сравни Москву и Санкт-Петербург.' },
        { role: 'assistant', content: 'Санкт-Петербург основан в 1703 году.' },
      ],
      rewrite: async (query, history) => {
        seen.push(query)
        expect(history).toHaveLength(2)
        return 'Кто основал Санкт-Петербург?'
      },
    })
    expect(seen).toEqual(['Кто основал более молодой из этих городов?'])
    expect(plan).toEqual({
      kind: 'search',
      query: 'Кто основал Санкт-Петербург?',
    })
  })

  it('падает обратно на исходный запрос без rewrite', async () => {
    const plan = await planRagQuery({ query: 'Расскажи про Казань' })
    expect(plan).toEqual({ kind: 'search', query: 'Расскажи про Казань' })
  })

  it('игнорирует пустую переформулировку', async () => {
    const plan = await planRagQuery({
      query: 'Расскажи про Казань',
      rewrite: async () => '   ',
    })
    expect(plan).toEqual({ kind: 'search', query: 'Расскажи про Казань' })
  })
})
