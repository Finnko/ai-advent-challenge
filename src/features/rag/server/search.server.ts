import type { Embedder } from '../domain/embedder'
import type { Reranker } from '../domain/reranker'
import type { Rewriter } from '../domain/rewrite-prompt'
import { cosineOf, relevanceOf } from '../domain/scoring'
import type { SearchScope } from '../domain/search-scope'
import type { ScoredChunk } from '../domain/types'
import { createEmbedder } from './embedder.server'
import type { RagIndexStore } from './index-store.server'
import { runPipeline } from './pipeline-run.server'
import {
  createReranker,
  resolveCosineThreshold,
  resolveRerankMargin,
  resolveRerankThreshold,
} from './reranker.server'
import { createDefaultRewriter } from './rewrite.server'
import { stitchSources, type RetrievalResult } from './retrieval.server'

export type SearchSourcesInput = {
  scope: SearchScope
  query: string
  store: RagIndexStore
  embedder?: Embedder
  reranker?: Reranker | null
  rewriter?: Rewriter | null
  rerankThreshold?: number | null
  cosineThreshold?: number
  margin?: number
  rewriteCache?: Map<string, string | null>
}

export type SourcesOutcome = {
  sources: ScoredChunk[]
  reranked: boolean
  candidateCount: number
  embeddingQuery: string
  rewrittenQuery: string | null
  confidence: number | null
  threshold: number
  weak: boolean
}

function confidenceOf(retrieval: RetrievalResult): number | null {
  const top = retrieval.results[0]
  if (!top) {
    return null
  }
  return retrieval.reranked ? relevanceOf(top) : cosineOf(top)
}

// Retrieval plus the relevance policy every consumer needs: which score the
// confidence is read from, which threshold it is compared against, and whether
// the fragments are good enough to answer from. Weak means "not enough to
// answer from the documents"; whether that becomes an abstention is the
// answering path's decision.
export async function searchSources(
  input: SearchSourcesInput,
): Promise<SourcesOutcome> {
  const { scope } = input
  const rerankThreshold =
    input.rerankThreshold === undefined
      ? resolveRerankThreshold()
      : input.rerankThreshold
  const cosineThreshold = input.cosineThreshold ?? resolveCosineThreshold()
  const { retrieval, rewrittenQuery } = await runPipeline(
    { rewrite: scope.rewrite, rerank: scope.rerank },
    {
      strategy: scope.strategy,
      query: input.query,
      k: scope.k,
      candidateK: scope.candidateK,
      threshold: rerankThreshold,
      rewriteCache: input.rewriteCache,
    },
    {
      embedder: input.embedder ?? createEmbedder(),
      store: input.store,
      reranker: scope.rerank ? (input.reranker ?? createReranker()) : null,
      rewriter: scope.rewrite
        ? (input.rewriter ?? createDefaultRewriter())
        : null,
      margin: input.margin ?? resolveRerankMargin(),
    },
  )
  const sources = scope.stitch
    ? stitchSources(retrieval.results, input.store, scope.strategy)
    : retrieval.results
  const threshold = retrieval.reranked
    ? (rerankThreshold ?? resolveRerankThreshold())
    : cosineThreshold
  const confidence = confidenceOf(retrieval)
  return {
    sources,
    reranked: retrieval.reranked,
    candidateCount: retrieval.candidateCount,
    embeddingQuery: retrieval.embeddingQuery,
    rewrittenQuery,
    confidence,
    threshold,
    weak:
      sources.length === 0 || (confidence !== null && confidence < threshold),
  }
}
