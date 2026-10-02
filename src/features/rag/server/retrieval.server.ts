import type { Embedder } from '../domain/embedder'
import { dot } from '../domain/embedder'
import {
  candidateKFor,
  COSINE_TIE_EPSILON,
  DEFAULT_RERANK_MARGIN,
} from '../domain/pipelines'
import type { Reranker } from '../domain/reranker'
import type { Chunk, ChunkingStrategyId, ScoredChunk } from '../domain/types'
import type { RagIndexStore } from './index-store.server'

export type SearchOptions = {
  strategy: ChunkingStrategyId
  query: string
  k: number
  embedder: Embedder
  store: RagIndexStore
  candidateK?: number
  reranker?: Reranker | null
  threshold?: number | null
  margin?: number | null
  rewrittenQuery?: string | null
}

export type RetrievalResult = {
  results: ScoredChunk[]
  reranked: boolean
  candidateCount: number
  embeddingQuery: string
}

const EMPTY_RESULT: RetrievalResult = {
  results: [],
  reranked: false,
  candidateCount: 0,
  embeddingQuery: '',
}

async function cosineCandidates(
  options: SearchOptions,
  embeddingQuery: string,
): Promise<ScoredChunk[]> {
  const [queryVector] = await options.embedder.embed([embeddingQuery], 'query')
  const stored = options.store.listStoredChunks(options.strategy)
  const scored: ScoredChunk[] = stored.map(({ chunk, embedding }) => {
    const score = dot(queryVector, embedding)
    return { chunk, score, originalScore: score }
  })
  scored.sort((a, b) => b.score - a.score)
  const candidateK = Math.max(1, options.candidateK ?? candidateKFor(options.k))
  return scored.slice(0, candidateK)
}

async function rerankCandidates(
  query: string,
  candidates: ScoredChunk[],
  reranker: Reranker | null | undefined,
  margin: number,
): Promise<boolean> {
  if (!reranker || candidates.length === 0) {
    return false
  }
  try {
    const scores = await reranker.rerank({
      query,
      documents: candidates.map((candidate) => candidate.chunk.text),
    })
    candidates.forEach((candidate, index) => {
      const relevance = scores[index]
      if (typeof relevance === 'number' && Number.isFinite(relevance)) {
        candidate.relevance = relevance
        candidate.score = relevance
      }
    })
    candidates.sort((a, b) => compareWithMargin(a, b, margin))
    return candidates.some((candidate) => candidate.relevance !== undefined)
  } catch {
    return false
  }
}

function effectiveRelevance(candidate: ScoredChunk): number {
  return candidate.relevance ?? candidate.score
}

function compareWithMargin(
  a: ScoredChunk,
  b: ScoredChunk,
  margin: number,
): number {
  const relevanceDelta = effectiveRelevance(b) - effectiveRelevance(a)
  const cosineDelta =
    (b.originalScore ?? b.score) - (a.originalScore ?? a.score)
  const cosineTied = Math.abs(cosineDelta) <= COSINE_TIE_EPSILON
  if (cosineTied && Math.abs(relevanceDelta) < margin) {
    return cosineDelta
  }
  return relevanceDelta
}

function selectResults(
  candidates: ScoredChunk[],
  options: SearchOptions,
  reranked: boolean,
): ScoredChunk[] {
  if (candidates.length === 0) {
    return []
  }
  const k = Math.max(1, options.k)
  if (!reranked) {
    return candidates.slice(0, k)
  }
  const threshold = options.threshold
  if (threshold === null || threshold === undefined) {
    return candidates.slice(0, k)
  }
  const kept = candidates
    .filter(
      (candidate) => (candidate.relevance ?? candidate.score) >= threshold,
    )
    .slice(0, k)
  return kept.length > 0 ? kept : [candidates[0]]
}

export async function retrieve(
  options: SearchOptions,
): Promise<RetrievalResult> {
  const query = options.query.trim()
  const embeddingQuery = (options.rewrittenQuery ?? options.query).trim()
  if (query.length === 0 || embeddingQuery.length === 0) {
    return EMPTY_RESULT
  }
  const candidates = await cosineCandidates(options, embeddingQuery)
  const margin = options.margin ?? DEFAULT_RERANK_MARGIN
  const reranked = await rerankCandidates(
    query,
    candidates,
    options.reranker,
    margin,
  )
  return {
    results: selectResults(candidates, options, reranked),
    reranked,
    candidateCount: candidates.length,
    embeddingQuery,
  }
}

export async function searchChunks(
  options: SearchOptions,
): Promise<ScoredChunk[]> {
  return (await retrieve(options)).results
}

export function stitchSources(
  sources: ScoredChunk[],
  store: RagIndexStore,
  strategy: ChunkingStrategyId,
): ScoredChunk[] {
  if (sources.length === 0) {
    return []
  }
  const byDoc = new Map<string, Chunk[]>()
  for (const chunk of store.listChunks(strategy)) {
    const list = byDoc.get(chunk.docId) ?? []
    list.push(chunk)
    byDoc.set(chunk.docId, list)
  }
  for (const list of byDoc.values()) {
    list.sort((a, b) => a.position - b.position)
  }
  const seen = new Set(sources.map((source) => source.chunk.chunkId))
  const expanded: ScoredChunk[] = []
  for (const source of sources) {
    expanded.push(source)
    const siblings = byDoc.get(source.chunk.docId)
    if (!siblings) {
      continue
    }
    const index = siblings.findIndex(
      (chunk) => chunk.chunkId === source.chunk.chunkId,
    )
    if (index < 0) {
      continue
    }
    for (const offset of [-1, 1]) {
      const neighbor = siblings[index + offset]
      if (
        !neighbor ||
        seen.has(neighbor.chunkId) ||
        neighbor.section !== source.chunk.section
      ) {
        continue
      }
      seen.add(neighbor.chunkId)
      expanded.push({ chunk: neighbor, score: source.score, stitched: true })
    }
  }
  return expanded
}
