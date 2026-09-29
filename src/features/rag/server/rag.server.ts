import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { CorpusSource } from '../domain/corpus'
import type { Embedder } from '../domain/embedder'
import type { ChunkingStrategyId } from '../domain/types'
import { compareStrategies, type RagComparison } from './comparison.server'
import { createWikiCorpusSource, listCorpusStatus, resolveCorpusDir, type CorpusDocStatus } from './corpus.server'
import { createEmbedder, resolveEmbedModelId } from './embedder.server'
import { buildIndex, type BuildIndexResult } from './indexing.server'
import { getRagStore, type RagIndexStore } from './index-store.server'
import { searchChunks } from './retrieval.server'

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

export async function getComparison(deps?: RagDeps): Promise<RagComparison> {
  const resolved = deps ?? (await defaultRagDeps())
  return compareStrategies({ embedder: resolved.embedder, store: resolved.store })
}

export async function search(
  strategy: ChunkingStrategyId,
  query: string,
  k: number,
  deps?: RagDeps,
) {
  const resolved = deps ?? (await defaultRagDeps())
  return searchChunks({
    strategy,
    query,
    k,
    embedder: resolved.embedder,
    store: resolved.store,
  })
}

export async function getCorpus(): Promise<CorpusDocStatus[]> {
  return listCorpusStatus()
}

export async function listChunksFor(
  strategy: ChunkingStrategyId,
  limit: number,
  store?: RagIndexStore,
) {
  const resolved = store ?? (await getRagStore())
  return resolved.listChunks(strategy).slice(0, Math.max(1, limit))
}
