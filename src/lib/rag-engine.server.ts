// Reusable RAG facade.
//
// `features/rag` owns the internals; this module is the app-level seam that
// lets other features (dev-assistant, and any future one) reuse the same
// corpus → chunks → embeddings → index → search → answer machinery without
// importing `features/rag` directly. Composition lives here, exactly like
// `agent-rag.server.ts` composes RAG into the agent.
import {
  createStructuralChunker,
  type StructuralChunkerOptions,
} from '@/features/rag/domain/chunking/structural'
import { buildSourceMessages } from '@/features/rag/domain/answer-persona'
import {
  MARKDOWN_HEADING_RE,
  parseSections,
} from '@/features/rag/domain/sections'
import type {
  AnswerLlm,
  AnswerLlmOptions,
  AnswerLlmResult,
} from '@/features/rag/server/answer-llm.server'
import {
  createEmbedder,
  resolveEmbedModelId,
} from '@/features/rag/server/embedder.server'
import {
  buildIndex,
  type BuildIndexOptions,
  type BuildIndexResult,
} from '@/features/rag/server/indexing.server'
import {
  assertIndexBuilt,
  createRagStore,
  EmptyIndexError,
  type DocumentRecord,
  type RagIndexStore,
} from '@/features/rag/server/index-store.server'
import { resolveAnswerLlm } from '@/features/rag/server/runtime.server'
import {
  searchSources,
  type SearchSourcesInput,
  type SourcesOutcome,
} from '@/features/rag/server/search.server'
import {
  answerFromSources,
  type SourceAnswer,
} from '@/features/rag/server/source-answer.server'
import { resolveStorePath } from '@/features/rag/shared/store-path.server'

export {
  assertIndexBuilt,
  createEmbedder,
  createRagStore,
  createStructuralChunker,
  EmptyIndexError,
  MARKDOWN_HEADING_RE,
  parseSections,
  resolveAnswerLlm,
  resolveEmbedModelId,
  resolveStorePath,
  searchSources,
  answerFromSources,
  buildIndex,
  buildSourceMessages,
}

export type {
  AnswerLlm,
  AnswerLlmOptions,
  AnswerLlmResult,
  BuildIndexOptions,
  BuildIndexResult,
  DocumentRecord,
  RagIndexStore,
  SearchSourcesInput,
  SourceAnswer,
  SourcesOutcome,
  StructuralChunkerOptions,
}
