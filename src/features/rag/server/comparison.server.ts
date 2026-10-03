import type { EvalQuery } from '../data/eval-queries'
import { EVAL_QUERIES } from '../data/eval-queries'
import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { Embedder } from '../domain/embedder'
import type { RetrievalStats, StructuralStats } from '../domain/metrics'
import { chunkStats, retrievalStats } from '../domain/metrics'
import {
  RAG_PIPELINE_IDS,
  resolvePipeline,
  type RagPipelineId,
} from '../domain/pipelines'
import type { Reranker } from '../domain/reranker'
import type { Rewriter } from '../domain/rewrite-prompt'
import type { ChunkingStrategyId } from '../domain/types'
import type { RagIndexStore } from './index-store.server'
import { runPipeline } from './pipeline-run.server'

export type PipelineRetrieval = {
  pipeline: RagPipelineId
  retrieval: RetrievalStats
}

export type StrategyComparison = {
  strategy: ChunkingStrategyId
  model: string | null
  builtAt: string | null
  structural: StructuralStats
  retrieval: RetrievalStats
  pipelines: PipelineRetrieval[]
}

export type RagComparison = {
  strategies: StrategyComparison[]
  queryCount: number
  includeRewrite: boolean
}

export type EvaluateOptions = {
  strategy: ChunkingStrategyId
  embedder: Embedder
  store: RagIndexStore
  queries?: EvalQuery[]
  k?: number
  reranker?: Reranker | null
  rewriter?: Rewriter | null
  threshold?: number
  margin?: number
  includeRewrite?: boolean
  rewriteCache?: Map<string, string | null>
}

function pipelinesFor(includeRewrite: boolean): RagPipelineId[] {
  if (includeRewrite) {
    return RAG_PIPELINE_IDS
  }
  return RAG_PIPELINE_IDS.filter((id) => !resolvePipeline(id).rewrite)
}

async function evaluatePipeline(
  options: EvaluateOptions,
  pipeline: RagPipelineId,
  queries: EvalQuery[],
  k: number,
  hasChunks: boolean,
): Promise<RetrievalStats> {
  const rankedByQuery = new Map<string, string[]>()
  if (!hasChunks) {
    return retrievalStats(queries, rankedByQuery)
  }
  const config = resolvePipeline(pipeline)
  for (const query of queries) {
    const { retrieval } = await runPipeline(
      config,
      {
        strategy: options.strategy,
        query: query.query,
        k,
        threshold: options.threshold ?? null,
        rewriteCache: options.rewriteCache,
      },
      {
        embedder: options.embedder,
        store: options.store,
        reranker: options.reranker ?? null,
        rewriter: options.rewriter ?? null,
        margin: options.margin ?? null,
      },
    )
    rankedByQuery.set(
      query.id,
      retrieval.results.map((result) => result.chunk.title),
    )
  }
  return retrievalStats(queries, rankedByQuery)
}

export async function evaluateStrategy(
  options: EvaluateOptions,
): Promise<StrategyComparison> {
  const queries = options.queries ?? EVAL_QUERIES
  const k = options.k ?? 5
  const chunks = options.store.listChunks(options.strategy)
  const pipelines = pipelinesFor(options.includeRewrite ?? false)
  const results: PipelineRetrieval[] = []
  for (const pipeline of pipelines) {
    results.push({
      pipeline,
      retrieval: await evaluatePipeline(
        options,
        pipeline,
        queries,
        k,
        chunks.length > 0,
      ),
    })
  }
  return {
    strategy: options.strategy,
    model: options.store.getMeta(`${options.strategy}.model`),
    builtAt: options.store.getMeta(`${options.strategy}.built_at`),
    structural: chunkStats(chunks),
    retrieval: results[0]?.retrieval ?? retrievalStats(queries, new Map()),
    pipelines: results,
  }
}

export async function compareStrategies(
  options: Omit<EvaluateOptions, 'strategy'>,
): Promise<RagComparison> {
  const queries = options.queries ?? EVAL_QUERIES
  const includeRewrite = options.includeRewrite ?? false
  const rewriteCache = options.rewriteCache ?? new Map<string, string | null>()
  const strategies: StrategyComparison[] = []
  for (const strategy of CHUNKING_STRATEGY_IDS) {
    strategies.push(
      await evaluateStrategy({
        ...options,
        strategy,
        queries,
        includeRewrite,
        rewriteCache,
      }),
    )
  }
  return { strategies, queryCount: queries.length, includeRewrite }
}
