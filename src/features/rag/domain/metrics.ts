import type { EvalQuery } from '../data/eval-queries'
import type { Chunk } from './types'

export type StructuralStats = {
  chunkCount: number
  totalTokens: number
  avgTokens: number
  medianTokens: number
  minTokens: number
  maxTokens: number
  crossesSection: number
  crossesSectionRatio: number
}

export type RetrievalStats = {
  queryCount: number
  recallAt3: number
  recallAt5: number
  mrr: number
}

export function dedupeKeys(keys: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(key)
    }
  }
  return unique
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function chunkStats(chunks: Chunk[]): StructuralStats {
  if (chunks.length === 0) {
    return {
      chunkCount: 0,
      totalTokens: 0,
      avgTokens: 0,
      medianTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      crossesSection: 0,
      crossesSectionRatio: 0,
    }
  }
  const tokens = chunks.map((chunk) => chunk.nTokens)
  const totalTokens = tokens.reduce((sum, value) => sum + value, 0)
  const crossesSection = chunks.filter((chunk) => chunk.crossesSection).length
  return {
    chunkCount: chunks.length,
    totalTokens,
    avgTokens: totalTokens / chunks.length,
    medianTokens: median(tokens),
    minTokens: Math.min(...tokens),
    maxTokens: Math.max(...tokens),
    crossesSection,
    crossesSectionRatio: crossesSection / chunks.length,
  }
}

export function recallAtK(
  ranked: string[],
  relevant: string[],
  k: number,
): number {
  if (relevant.length === 0) {
    return 0
  }
  const top = new Set(dedupeKeys(ranked).slice(0, k))
  let hits = 0
  for (const key of relevant) {
    if (top.has(key)) {
      hits += 1
    }
  }
  return hits / relevant.length
}

export function reciprocalRank(ranked: string[], relevant: string[]): number {
  const relevantSet = new Set(relevant)
  const unique = dedupeKeys(ranked)
  for (let index = 0; index < unique.length; index += 1) {
    if (relevantSet.has(unique[index])) {
      return 1 / (index + 1)
    }
  }
  return 0
}

export function retrievalStats(
  queries: EvalQuery[],
  rankedByQuery: Map<string, string[]>,
): RetrievalStats {
  const recall3: number[] = []
  const recall5: number[] = []
  const reciprocal: number[] = []
  for (const query of queries) {
    const ranked = rankedByQuery.get(query.id) ?? []
    recall3.push(recallAtK(ranked, query.relevant, 3))
    recall5.push(recallAtK(ranked, query.relevant, 5))
    reciprocal.push(reciprocalRank(ranked, query.relevant))
  }
  return {
    queryCount: queries.length,
    recallAt3: mean(recall3),
    recallAt5: mean(recall5),
    mrr: mean(reciprocal),
  }
}
