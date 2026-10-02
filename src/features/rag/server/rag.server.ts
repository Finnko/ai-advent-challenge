import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { ChunkingStrategyId } from '../domain/types'
import {
  answerQuestion,
  type AnswerInput,
  type AnswerResponse,
} from './answer.server'
import { resolveEmbedModelId } from './embedder.server'
import { getRagStore, type RagIndexStore } from './index-store.server'
import { buildIndex, type BuildIndexResult } from './indexing.server'
import { runPipeline } from './pipeline-run.server'
import {
  resolveRuntime,
  type AnswerRuntimeOverrides,
  type RagRuntimeOverrides,
} from './runtime.server'
import { compareStrategies, type RagComparison } from './comparison.server'
import { listCorpusStatus, type CorpusDocStatus } from './corpus.server'
import type { RetrievalResult } from './retrieval.server'

export async function buildStrategyIndex(
  strategy: ChunkingStrategyId,
  deps?: RagRuntimeOverrides,
): Promise<BuildIndexResult> {
  const runtime = await resolveRuntime(deps)
  return buildIndex({
    strategy,
    corpus: runtime.corpus,
    embedder: runtime.embedder,
    store: runtime.store,
  })
}

export async function buildAllIndexes(
  deps?: RagRuntimeOverrides,
): Promise<BuildIndexResult[]> {
  const runtime = await resolveRuntime(deps)
  const results: BuildIndexResult[] = []
  for (const strategy of CHUNKING_STRATEGY_IDS) {
    results.push(await buildStrategyIndex(strategy, runtime))
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
  deps?: RagRuntimeOverrides,
): Promise<RagComparison> {
  const runtime = await resolveRuntime(deps)
  return compareStrategies({
    embedder: runtime.embedder,
    store: runtime.store,
    reranker: runtime.reranker,
    rewriter: runtime.rewriter,
    threshold: runtime.threshold,
    margin: runtime.margin,
    includeRewrite: input?.includeRewrite ?? false,
  })
}

export async function search(
  input: SearchInput,
  deps?: RagRuntimeOverrides,
): Promise<SearchResult> {
  const runtime = await resolveRuntime(deps)
  const threshold =
    input.threshold === undefined ? runtime.threshold : input.threshold
  const { retrieval, rewrittenQuery } = await runPipeline(
    { rewrite: input.rewrite === true, rerank: input.rerank === true },
    {
      strategy: input.strategy,
      query: input.query,
      k: input.k,
      candidateK: input.candidateK,
      threshold,
    },
    {
      embedder: runtime.embedder,
      store: runtime.store,
      reranker: runtime.reranker,
      rewriter: runtime.rewriter,
      margin: runtime.margin,
    },
  )
  return { ...retrieval, rewrittenQuery }
}

export async function getCorpus(): Promise<CorpusDocStatus[]> {
  return listCorpusStatus()
}

export type { AnswerInput, AnswerResponse }

export async function answer(
  input: AnswerInput,
  deps?: AnswerRuntimeOverrides,
): Promise<AnswerResponse> {
  return answerQuestion(input, deps)
}

export async function listChunksFor(
  strategy: ChunkingStrategyId,
  limit: number,
  store?: RagIndexStore,
) {
  const resolved = store ?? (await getRagStore())
  return resolved.listChunks(strategy).slice(0, Math.max(1, limit))
}
