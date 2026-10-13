// Reusable RAG facade.
//
// `features/rag` owns the internals; this module is the app-level seam that
// lets other features (dev-assistant, and any future one) reuse the same
// corpus → chunks → embeddings → index → retrieval → answer machinery without
// importing `features/rag` directly. Composition lives here, exactly like
// `agent-rag.server.ts` composes RAG into the agent.
import {
  buildChunks,
  tokenWindows,
} from '@/features/rag/domain/chunking/windows'
import { cosineOf, relevanceOf } from '@/features/rag/domain/scoring'
import { parseAnswerResponse } from '@/features/rag/domain/answer-format'
import { parseCitations, verifyQuotes } from '@/features/rag/domain/answer-eval'
import {
  createDeepSeekAnswerLlm,
  type AnswerLlm,
  type AnswerLlmOptions,
  type AnswerLlmResult,
} from '@/features/rag/server/answer-llm.server'
import {
  createEmbedder,
  resolveEmbedModelId,
} from '@/features/rag/server/embedder.server'
import {
  createRagStore,
  type DocumentRecord,
  type RagIndexStore,
} from '@/features/rag/server/index-store.server'
import {
  buildIndex,
  type BuildIndexOptions,
  type BuildIndexResult,
} from '@/features/rag/server/indexing.server'
import { createLocalAnswerLlm } from '@/features/rag/server/local-llm.server'
import {
  createReranker,
  resolveCosineThreshold,
  resolveRerankMargin,
  resolveRerankThreshold,
} from '@/features/rag/server/reranker.server'
import {
  retrieve,
  stitchSources,
  type RetrievalResult,
} from '@/features/rag/server/retrieval.server'
import { resolveStorePath } from '@/features/rag/shared/store-path.server'
import type { AnswerGenerator } from '@/features/rag/domain/types'

export {
  buildChunks,
  tokenWindows,
  cosineOf,
  relevanceOf,
  parseAnswerResponse,
  parseCitations,
  verifyQuotes,
  createEmbedder,
  resolveEmbedModelId,
  createRagStore,
  buildIndex,
  createLocalAnswerLlm,
  createDeepSeekAnswerLlm,
  createReranker,
  resolveCosineThreshold,
  resolveRerankMargin,
  resolveRerankThreshold,
  retrieve,
  stitchSources,
  resolveStorePath,
}

export type {
  AnswerLlm,
  AnswerLlmOptions,
  AnswerLlmResult,
  BuildIndexOptions,
  BuildIndexResult,
  DocumentRecord,
  RagIndexStore,
  RetrievalResult,
}

export function createAnswerLlm(generator: AnswerGenerator): AnswerLlm {
  return generator === 'local'
    ? createLocalAnswerLlm()
    : createDeepSeekAnswerLlm()
}
