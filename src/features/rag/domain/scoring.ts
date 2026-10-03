import type { ScoredChunk } from './types'

export function relevanceOf(candidate: ScoredChunk): number {
  return candidate.relevance ?? candidate.score
}

export function cosineOf(candidate: ScoredChunk): number {
  return candidate.originalScore ?? candidate.score
}
