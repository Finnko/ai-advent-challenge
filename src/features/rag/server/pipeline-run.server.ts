import type { Embedder } from '../domain/embedder'
import type { PipelineConfig } from '../domain/pipelines'
import type { Reranker } from '../domain/reranker'
import { rewriteQuery, type Rewriter } from '../domain/rewrite-prompt'
import type { ChunkingStrategyId } from '../domain/types'
import type { RagIndexStore } from './index-store.server'
import { retrieve, type RetrievalResult } from './retrieval.server'

export type PipelineRunInput = {
  strategy: ChunkingStrategyId
  query: string
  k: number
  candidateK?: number
  threshold?: number | null
  rewriteCache?: Map<string, string | null>
}

export type PipelineRunDeps = {
  embedder: Embedder
  store: RagIndexStore
  reranker?: Reranker | null
  rewriter?: Rewriter | null
  margin?: number | null
}

export type PipelineRunResult = {
  retrieval: RetrievalResult
  rewrittenQuery: string | null
}

async function rewriteFor(
  config: PipelineConfig,
  input: PipelineRunInput,
  rewriter: Rewriter | null | undefined,
): Promise<string | null> {
  if (!config.rewrite) {
    return null
  }
  const cache = input.rewriteCache
  if (cache?.has(input.query)) {
    return cache.get(input.query) ?? null
  }
  const rewritten = await rewriteQuery(input.query, rewriter)
  cache?.set(input.query, rewritten)
  return rewritten
}

export async function runPipeline(
  config: PipelineConfig,
  input: PipelineRunInput,
  deps: PipelineRunDeps,
): Promise<PipelineRunResult> {
  const rewrittenQuery = await rewriteFor(config, input, deps.rewriter)
  const retrieval = await retrieve({
    strategy: input.strategy,
    query: input.query,
    k: input.k,
    candidateK: input.candidateK,
    embedder: deps.embedder,
    store: deps.store,
    reranker: config.rerank ? (deps.reranker ?? null) : null,
    threshold: config.rerank ? (input.threshold ?? null) : null,
    margin: config.rerank ? (deps.margin ?? null) : null,
    rewrittenQuery,
  })
  return { retrieval, rewrittenQuery }
}
