import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { CorpusSource } from '../domain/corpus'
import type { Embedder } from '../domain/embedder'
import type { Reranker } from '../domain/reranker'
import { rewriteQuery, type Rewriter } from '../domain/rewrite-prompt'
import type { ChunkingStrategyId } from '../domain/types'
import { compareStrategies, type RagComparison } from './comparison.server'
import {
  createWikiCorpusSource,
  listCorpusStatus,
  resolveCorpusDir,
  type CorpusDocStatus,
} from './corpus.server'
import { createEmbedder, resolveEmbedModelId } from './embedder.server'
import { buildIndex, type BuildIndexResult } from './indexing.server'
import { getRagStore, type RagIndexStore } from './index-store.server'
import {
  createReranker,
  resolveRerankMargin,
  resolveRerankThreshold,
} from './reranker.server'
import { retrieve, type RetrievalResult } from './retrieval.server'
import { createDefaultRewriter } from './rewrite.server'
import {
  answerQuestion,
  defaultAnswerDeps,
  type AnswerDeps,
  type AnswerInput,
  type AnswerResponse,
} from './answer.server'

export type RagDeps = {
  corpus: CorpusSource
  embedder: Embedder
  store: RagIndexStore
}

export async function defaultRagDeps(): Promise<RagDeps> {
  const dir = await resolveCorpusDir()
  return {
    corpus: createWikiCorpusSource({ dir }),
    embedder: createEmbedder(),
    store: await getRagStore(),
  }
}

export async function buildStrategyIndex(
  strategy: ChunkingStrategyId,
  deps?: RagDeps,
): Promise<BuildIndexResult> {
  const resolved = deps ?? (await defaultRagDeps())
  return buildIndex({
    strategy,
    corpus: resolved.corpus,
    embedder: resolved.embedder,
    store: resolved.store,
  })
}

export async function buildAllIndexes(
  deps?: RagDeps,
): Promise<BuildIndexResult[]> {
  const resolved = deps ?? (await defaultRagDeps())
  const results: BuildIndexResult[] = []
  for (const strategy of CHUNKING_STRATEGY_IDS) {
    results.push(await buildStrategyIndex(strategy, resolved))
  }
  return results
}

export type StrategyIndexStats = {
  strategy: ChunkingStrategyId
  chunkCount: number
  model: string | null
  builtAt: string | null
  dim: number
}

export type IndexStats = {
  documents: ReturnType<RagIndexStore['listDocuments']>
  strategies: StrategyIndexStats[]
  embedModel: string
}

export async function getIndexStats(
  store?: RagIndexStore,
): Promise<IndexStats> {
  const resolved = store ?? (await getRagStore())
  return {
    documents: resolved.listDocuments(),
    strategies: CHUNKING_STRATEGY_IDS.map((strategy) => ({
      strategy,
      chunkCount: resolved.countChunks(strategy),
      model: resolved.getMeta(`${strategy}.model`),
      builtAt: resolved.getMeta(`${strategy}.built_at`),
      dim: Number(resolved.getMeta(`${strategy}.dim`) ?? 0),
    })),
    embedModel: resolveEmbedModelId(),
  }
}

export type RetrievalDeps = RagDeps & {
  reranker: Reranker | null
  rewriter: Rewriter | null
  threshold: number
  margin: number
}

export async function defaultRetrievalDeps(): Promise<RetrievalDeps> {
  const base = await defaultRagDeps()
  return {
    ...base,
    reranker: createReranker(),
    rewriter: createDefaultRewriter(),
    threshold: resolveRerankThreshold(),
    margin: resolveRerankMargin(),
  }
}

export type SearchInput = {
  strategy: ChunkingStrategyId
  query: string
  k: number
  candidateK?: number
  rerank?: boolean
  rewrite?: boolean
  threshold?: number | null
}

export type SearchResult = RetrievalResult & { rewrittenQuery: string | null }

export async function getComparison(
  input?: { includeRewrite?: boolean },
  deps?: RetrievalDeps,
): Promise<RagComparison> {
  const resolved = deps ?? (await defaultRetrievalDeps())
  return compareStrategies({
    embedder: resolved.embedder,
    store: resolved.store,
    reranker: resolved.reranker,
    rewriter: resolved.rewriter,
    threshold: resolved.threshold,
    margin: resolved.margin,
    includeRewrite: input?.includeRewrite ?? false,
  })
}

export async function search(
  input: SearchInput,
  deps?: RetrievalDeps,
): Promise<SearchResult> {
  const resolved = deps ?? (await defaultRetrievalDeps())
  const rewrittenQuery = input.rewrite
    ? await rewriteQuery(input.query, resolved.rewriter)
    : null
  const threshold =
    input.threshold === undefined ? resolved.threshold : input.threshold
  const outcome = await retrieve({
    strategy: input.strategy,
    query: input.query,
    k: input.k,
    candidateK: input.candidateK,
    embedder: resolved.embedder,
    store: resolved.store,
    reranker: input.rerank ? resolved.reranker : null,
    threshold: input.rerank ? threshold : null,
    margin: input.rerank ? resolved.margin : null,
    rewrittenQuery,
  })
  return { ...outcome, rewrittenQuery }
}

export async function getCorpus(): Promise<CorpusDocStatus[]> {
  return listCorpusStatus()
}

export type { AnswerDeps, AnswerInput, AnswerResponse }

export async function answer(
  input: AnswerInput,
  deps?: AnswerDeps,
): Promise<AnswerResponse> {
  const resolved = deps ?? (await defaultAnswerDeps())
  return answerQuestion(input, resolved)
}

export async function listChunksFor(
  strategy: ChunkingStrategyId,
  limit: number,
  store?: RagIndexStore,
) {
  const resolved = store ?? (await getRagStore())
  return resolved.listChunks(strategy).slice(0, Math.max(1, limit))
}
