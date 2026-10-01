import { describe, expect, it } from 'vitest'
import type { EvalQuery } from '../data/eval-queries'
import {
  chunkStats,
  dedupeKeys,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  retrievalStats,
} from '../domain/metrics'
import type { Chunk } from '../domain/types'

function chunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    chunkId: 'c',
    strategy: 'fixed',
    docId: 'd',
    source: 's',
    title: 'Москва',
    section: null,
    sectionPath: [],
    position: 0,
    charStart: 0,
    charEnd: 10,
    nTokens: 10,
    crossesSection: false,
    text: 'x',
    ...overrides,
  }
}

describe('retrieval metrics', () => {
  it('dedupes ranked keys preserving order', () => {
    expect(dedupeKeys(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('computes recall at k on unique documents', () => {
    expect(recallAtK(['a', 'a', 'b', 'c'], ['a', 'b'], 3)).toBe(1)
    expect(recallAtK(['a', 'a', 'b'], ['a', 'b'], 1)).toBe(0.5)
  })

  it('computes reciprocal rank', () => {
    expect(reciprocalRank(['x', 'y', 'target'], ['target'])).toBeCloseTo(1 / 3)
    expect(reciprocalRank(['x'], ['target'])).toBe(0)
  })

  it('computes precision at k on unique documents', () => {
    expect(precisionAtK(['a', 'b', 'c', 'd', 'e'], ['a', 'c'], 5)).toBe(0.4)
    expect(precisionAtK(['a', 'a', 'c'], ['a', 'b'], 2)).toBe(0.5)
  })

  it('computes nDCG at k', () => {
    const perfect = ndcgAtK(['a', 'b', 'c', 'd', 'e'], ['a', 'b'], 5)
    expect(perfect).toBeCloseTo(1)
    const worse = ndcgAtK(['b', 'c', 'd', 'e', 'a'], ['a', 'b'], 5)
    expect(worse).toBeLessThan(perfect)
    expect(ndcgAtK(['x'], [], 5)).toBe(0)
  })

  it('aggregates query-level metrics', () => {
    const queries: EvalQuery[] = [
      { id: 'a', query: 'a', relevant: ['Москва'] },
      { id: 'b', query: 'b', relevant: ['Казань'] },
    ]
    const ranked = new Map<string, string[]>([
      ['a', ['Москва']],
      ['b', ['Казань']],
    ])
    const stats = retrievalStats(queries, ranked)
    expect(stats.recallAt3).toBe(1)
    expect(stats.mrr).toBe(1)
  })
})

describe('chunkStats', () => {
  it('summarises chunk sizes and boundary crossings', () => {
    const stats = chunkStats([
      chunk({ nTokens: 10, crossesSection: false }),
      chunk({ nTokens: 20, crossesSection: true }),
      chunk({ nTokens: 30, crossesSection: false }),
    ])
    expect(stats.chunkCount).toBe(3)
    expect(stats.avgTokens).toBe(20)
    expect(stats.medianTokens).toBe(20)
    expect(stats.minTokens).toBe(10)
    expect(stats.maxTokens).toBe(30)
    expect(stats.crossesSectionRatio).toBeCloseTo(1 / 3)
  })

  it('returns zeros for an empty index', () => {
    expect(chunkStats([]).chunkCount).toBe(0)
  })
})
