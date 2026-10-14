import type { AnswerVerdict } from '../domain/answer-eval'
import { isChunkingStrategyId } from '../domain/chunking/registry'
import { RAG_PIPELINE_IDS, type RagPipelineId } from '../domain/pipelines'
import type {
  AnswerGenerator,
  AnswerMode,
  ChunkingStrategyId,
  RagChunkingStrategyId,
} from '../domain/types'

export const STRATEGY_IDS: RagChunkingStrategyId[] = ['fixed', 'structural']

export const STRATEGY_LABELS: Record<RagChunkingStrategyId, string> = {
  fixed: 'По фиксированному размеру',
  structural: 'По структуре (разделы)',
}

export const STRATEGY_SHORT_LABELS: Record<RagChunkingStrategyId, string> = {
  fixed: 'fixed',
  structural: 'structural',
}

export const STRATEGY_DETAILS: Record<RagChunkingStrategyId, string> = {
  fixed: '256 токенов, перекрытие 32',
  structural: 'разделы статьи до 256 токенов',
}

export function strategyLabel(id: ChunkingStrategyId): string {
  return isChunkingStrategyId(id) ? STRATEGY_LABELS[id] : id
}

export function strategyShortLabel(id: ChunkingStrategyId): string {
  return isChunkingStrategyId(id) ? STRATEGY_SHORT_LABELS[id] : id
}

export function strategyDetails(id: ChunkingStrategyId): string {
  return isChunkingStrategyId(id) ? STRATEGY_DETAILS[id] : id
}

export const MODE_LABELS: Record<AnswerMode, string> = {
  rag: 'С RAG',
  baseline: 'Без RAG',
}

export const GENERATOR_IDS: AnswerGenerator[] = ['cloud', 'local']

export const GENERATOR_LABELS: Record<AnswerGenerator, string> = {
  cloud: 'Облако (DeepSeek)',
  local: 'Локальная (Qwen3-14B)',
}

export const GENERATOR_SHORT_LABELS: Record<AnswerGenerator, string> = {
  cloud: 'облако',
  local: 'локально',
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
  abstained: 'не знаю',
}
