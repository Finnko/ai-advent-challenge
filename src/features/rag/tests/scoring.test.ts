import { describe, expect, it } from 'vitest'
import { cosineOf, relevanceOf } from '../domain/scoring'
import type { ScoredChunk } from '../domain/types'

function candidate(overrides: Partial<ScoredChunk> = {}): ScoredChunk {
  return {
    chunk: {
      chunkId: 'c',
      strategy: 'fixed',
      docId: 'd',
      source: 's',
      title: 'T',
      section: null,
      sectionPath: [],
      position: 0,
      charStart: 0,
      charEnd: 0,
      nTokens: 0,
      crossesSection: false,
      text: 'text',
    },
    score: 0.5,
    ...overrides,
  }
}

describe('score accessors', () => {
  it('prefers rerank relevance, else falls back to score', () => {
    expect(relevanceOf(candidate())).toBe(0.5)
    expect(relevanceOf(candidate({ score: 0.2, relevance: 0.9 }))).toBe(0.9)
  })

  it('prefers the original cosine, else falls back to score', () => {
    expect(cosineOf(candidate())).toBe(0.5)
    expect(cosineOf(candidate({ score: 0.9, originalScore: 0.3 }))).toBe(0.3)
  })
})
