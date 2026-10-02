export type RagPipelineId =
  'rag' | 'rag+rerank' | 'rag+rewrite' | 'rag+rewrite+rerank'

export type PipelineConfig = {
  rewrite: boolean
  rerank: boolean
  threshold: number | null
}

export const DEFAULT_RERANK_THRESHOLD = 0.5

export const DEFAULT_COSINE_THRESHOLD = 0.35

export const DEFAULT_RERANK_MARGIN = 0.1

export const COSINE_TIE_EPSILON = 1e-6

export const RAG_PIPELINE_IDS: RagPipelineId[] = [
  'rag',
  'rag+rerank',
  'rag+rewrite',
  'rag+rewrite+rerank',
]

const PIPELINE_CONFIG: Record<RagPipelineId, PipelineConfig> = {
  rag: { rewrite: false, rerank: false, threshold: null },
  'rag+rerank': {
    rewrite: false,
    rerank: true,
    threshold: DEFAULT_RERANK_THRESHOLD,
  },
  'rag+rewrite': { rewrite: true, rerank: false, threshold: null },
  'rag+rewrite+rerank': {
    rewrite: true,
    rerank: true,
    threshold: DEFAULT_RERANK_THRESHOLD,
  },
}

export function isRagPipelineId(value: unknown): value is RagPipelineId {
  return (
    typeof value === 'string' && (RAG_PIPELINE_IDS as string[]).includes(value)
  )
}

export function resolvePipeline(id: RagPipelineId): PipelineConfig {
  return PIPELINE_CONFIG[id]
}

export function candidateKFor(k: number): number {
  return Math.max(4 * k, 20)
}
