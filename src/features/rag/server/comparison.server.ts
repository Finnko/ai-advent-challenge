import type { EvalQuery } from '../data/eval-queries'
import { EVAL_QUERIES } from '../data/eval-queries'
import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { Embedder } from '../domain/embedder'
import type { RetrievalStats, StructuralStats } from '../domain/metrics'
import { chunkStats, retrievalStats } from '../domain/metrics'
import type { ChunkingStrategyId } from '../domain/types'
import type { RagIndexStore } from './index-store.server'
import { searchChunks } from './retrieval.server'

export type StrategyComparison = {
  strategy: ChunkingStrategyId
  model: string | null
  builtAt: string | null
  structural: StructuralStats
  retrieval: RetrievalStats
}

export type RagComparison = {
  strategies: StrategyComparison[]
  queryCount: number
}

export type EvaluateOptions = {
  strategy: ChunkingStrategyId
  embedder: Embedder
  store: RagIndexStore
  queries?: EvalQuery[]
  k?: number
}

export async function evaluateStrategy(
  options: EvaluateOptions,
): Promise<StrategyComparison> {
  const queries = options.queries ?? EVAL_QUERIES
  const k = options.k ?? 5
  const chunks = options.store.listChunks(options.strategy)
  const rankedByQuery = new Map<string, string[]>()
  if (chunks.length > 0) {
    for (const query of queries) {
      const results = await searchChunks({
        strategy: options.strategy,
        query: query.query,
        k,
        embedder: options.embedder,
        store: options.store,
      })
      rankedByQuery.set(
        query.id,
        results.map((result) => result.chunk.title),
      )
    }
  }
  return {
    strategy: options.strategy,
    model: options.store.getMeta(`${options.strategy}.model`),
    builtAt: options.store.getMeta(`${options.strategy}.built_at`),
    structural: chunkStats(chunks),
    retrieval: retrievalStats(queries, rankedByQuery),
  }
}

export async function compareStrategies(
  options: Omit<EvaluateOptions, 'strategy'>,
): Promise<RagComparison> {
  const queries = options.queries ?? EVAL_QUERIES
  const strategies: StrategyComparison[] = []
  for (const strategy of CHUNKING_STRATEGY_IDS) {
    strategies.push(
      await evaluateStrategy({ ...options, strategy, queries }),
    )
  }
  return { strategies, queryCount: queries.length }
}
