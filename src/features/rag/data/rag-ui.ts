import type { AnswerVerdict } from '../domain/answer-eval'
import { RAG_PIPELINE_IDS, type RagPipelineId } from '../domain/pipelines'
import type { AnswerMode, ChunkingStrategyId } from '../domain/types'

export const STRATEGY_IDS: ChunkingStrategyId[] = ['fixed', 'structural']

export const STRATEGY_LABELS: Record<ChunkingStrategyId, string> = {
  fixed: 'По фиксированному размеру',
  structural: 'По структуре (разделы)',
}

export const STRATEGY_SHORT_LABELS: Record<ChunkingStrategyId, string> = {
  fixed: 'fixed',
  structural: 'structural',
}

export const STRATEGY_DETAILS: Record<ChunkingStrategyId, string> = {
  fixed: '256 токенов, перекрытие 32',
  structural: 'разделы статьи до 256 токенов',
}

export const MODE_LABELS: Record<AnswerMode, string> = {
  rag: 'С RAG',
  baseline: 'Без RAG',
}

export const PIPELINE_IDS: RagPipelineId[] = RAG_PIPELINE_IDS

export const PIPELINE_LABELS: Record<RagPipelineId, string> = {
  rag: 'RAG',
  'rag+rerank': 'RAG + реранк',
  'rag+rewrite': 'RAG + rewrite',
  'rag+rewrite+rerank': 'RAG + rewrite + реранк',
}

export const PIPELINE_SHORT_LABELS: Record<RagPipelineId, string> = {
  rag: 'rag',
  'rag+rerank': '+rerank',
  'rag+rewrite': '+rewrite',
  'rag+rewrite+rerank': '+rw+rr',
}

export const PIPELINE_DETAILS: Record<RagPipelineId, string> = {
  rag: 'косинус top-k без фильтра',
  'rag+rerank': 'cross-encoder + порог',
  'rag+rewrite': 'LLM-переформулировка запроса',
  'rag+rewrite+rerank': 'rewrite, затем реранк + порог',
}

export const VERDICT_LABELS: Record<AnswerVerdict, string> = {
  correct: 'верно',
  partial: 'частично',
  wrong: 'неверно',
  ungrounded: 'без опоры',
}
