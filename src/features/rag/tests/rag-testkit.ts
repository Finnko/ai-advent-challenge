import type { CorpusSource } from '../domain/corpus'
import type { RawDoc } from '../domain/types'

export function makeDoc(overrides: Partial<RawDoc> = {}): RawDoc {
  return {
    id: 'doc-1',
    title: 'Тест',
    source: 'https://example.org/wiki/Тест',
    text: 'Первый абзац текста с несколькими словами.',
    ...overrides,
  }
}

export function createFixtureCorpus(docs: RawDoc[]): CorpusSource {
  const refs = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    source: doc.source,
  }))
  return {
    async list() {
      return refs
    },
    async load(ref) {
      const doc = docs.find((candidate) => candidate.id === ref.id)
      if (!doc) {
        throw new Error(`Нет документа ${ref.id}`)
      }
      return doc
    },
  }
}

export const SAMPLE_WIKI = `Москва — столица России, крупнейший город страны.

== История ==
Первое упоминание Москвы относится к 1147 году в летописи.

=== Ранняя история ===
В XIII веке город стал центром удельного княжества.

== География ==
Город расположен в центре Восточно-Европейской равнины на реке Москве.
`
