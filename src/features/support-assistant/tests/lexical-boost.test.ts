import { describe, expect, it } from 'vitest'
import type { Chunk, ScoredChunk } from '@lib/rag-engine.types'
import { boostSources } from '../domain/lexical-boost'

type SourceOptions = {
  score?: number
  title?: string
  section?: string
}

function source(
  id: string,
  text: string,
  options: SourceOptions = {},
): ScoredChunk {
  const score = options.score ?? 0.8
  const chunk: Chunk = {
    chunkId: id,
    strategy: 'support',
    docId: id,
    source: 'https://seller-edu.ozon.ru/help',
    title: options.title ?? 'Документ',
    section: options.section ?? null,
    sectionPath: [],
    position: 0,
    charStart: 0,
    charEnd: text.length,
    nTokens: text.split(/\s+/).length,
    crossesSection: false,
    text,
  }
  return { chunk, score, originalScore: score }
}

function ids(sources: ScoredChunk[]): string[] {
  return sources.map((item) => item.chunk.chunkId)
}

describe('boostSources', () => {
  it('поднимает чанк с лексическим совпадением', () => {
    const dense = source(
      'dense',
      'Доступ к разделу ограничен по другим причинам.',
      {
        score: 0.81,
      },
    )
    const lexical = source(
      'lexical',
      'Ozon блокирует личный кабинет, если не подтверждены права на товарный знак.',
      { score: 0.8 },
    )
    const ranked = boostSources(
      'Почему заблокировали личный кабинет?',
      [dense, lexical],
      { weight: 0.03 },
    )
    expect(ids(ranked)).toEqual(['lexical', 'dense'])
    expect(ranked[0].score).toBeCloseTo(0.83, 5)
  })

  it('не меняет порядок без совпадений', () => {
    const first = source('first', 'Правила публикации товаров.', {
      score: 0.81,
    })
    const second = source('second', 'Требования к карточкам.', { score: 0.8 })
    const ranked = boostSources('регламент выплат', [first, second], {
      weight: 0.03,
    })
    expect(ids(ranked)).toEqual(['first', 'second'])
    expect(ranked[0].score).toBe(0.81)
  })

  it('выключается нулевым весом', () => {
    const first = source('first', 'Правила публикации товаров.', {
      score: 0.81,
    })
    const second = source('second', 'Требования к карточкам.', { score: 0.8 })
    const ranked = boostSources('кабинет', [first, second], { weight: 0 })
    expect(ids(ranked)).toEqual(['first', 'second'])
    expect(ranked[1].score).toBe(0.8)
  })

  it('не мутирует входные чанки', () => {
    const dense = source('dense', 'Доступ к разделу ограничен.', {
      score: 0.81,
    })
    const lexical = source('lexical', 'Ozon блокирует личный кабинет.', {
      score: 0.8,
    })
    boostSources('заблокировали кабинет', [dense, lexical], { weight: 0.03 })
    expect(dense.score).toBe(0.81)
    expect(lexical.score).toBe(0.8)
  })

  it('взвешивает заголовок раздела выше текста', () => {
    const section = source('section', 'Информация о расчётах.', {
      score: 0.8,
      section: 'Сроки выплат',
    })
    const text = source('text', 'Когда приходят выплаты продавцу.', {
      score: 0.8,
    })
    const ranked = boostSources('сроки выплат', [text, section], {
      weight: 0.03,
    })
    expect(ids(ranked)).toEqual(['section', 'text'])
  })

  it('даёт редкому термину больший вес, чем частому', () => {
    const commonA = source('commonA', 'Выплаты продавцу приходят раз в неделю.')
    const rare = source('rare', 'Критерии модерации карточек товаров.')
    const commonB = source('commonB', 'Сроки выплат зависят от тарифа.')
    const ranked = boostSources('выплата модерация', [commonA, rare, commonB], {
      weight: 0.03,
    })
    expect(ids(ranked)[0]).toBe('rare')
  })

  it('нормализует регистр и ё', () => {
    const other = source('other', 'Сроки выплат.', { score: 0.8 })
    const doc = source(
      'doc',
      'Подтверждение прав на товарный знак обязательно.',
      {
        score: 0.8,
      },
    )
    const ranked = boostSources('ПОДТВЕРДИЛИ ПРАВА', [other, doc], {
      weight: 0.03,
    })
    expect(ranked[0].chunk.chunkId).toBe('doc')
  })

  it('сопоставляет аббревиатуры точно', () => {
    const other = source('other', 'Схема FBO: товар на складе Ozon.')
    const fbs = source('fbs', 'Схема FBS: товар хранит продавец.')
    const ranked = boostSources('FBS', [other, fbs], { weight: 0.03 })
    expect(ranked[0].chunk.chunkId).toBe('fbs')
  })

  it('игнорирует запрос из одних стоп-слов', () => {
    const first = source('first', 'Правила публикации товаров.', {
      score: 0.81,
    })
    const second = source('second', 'Требования к карточкам.', { score: 0.8 })
    const ranked = boostSources('и в на', [first, second], { weight: 0.03 })
    expect(ids(ranked)).toEqual(['first', 'second'])
    expect(ranked[0].score).toBe(0.81)
  })
})
