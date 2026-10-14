import type { ChunkingStrategyId } from './types'

// An area of search: which corpus slice and chunking strategy to read, how many
// fragments to take, and whether rewrite/reranking/stitching are on. Callers
// name an area instead of assembling `retrieve` options themselves.
export type SearchScope = {
  strategy: ChunkingStrategyId
  k: number
  rerank: boolean
  rewrite: boolean
  stitch?: boolean
  candidateK?: number
}
