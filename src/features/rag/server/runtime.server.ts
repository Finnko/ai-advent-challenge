import type { CorpusSource } from '../domain/corpus'
import type { Embedder } from '../domain/embedder'
import type { Reranker } from '../domain/reranker'
import type { Rewriter } from '../domain/rewrite-prompt'
import { createDeepSeekAnswerLlm, type AnswerLlm } from './answer-llm.server'
import { createWikiCorpusSource, resolveCorpusDir } from './corpus.server'
import { createEmbedder } from './embedder.server'
import { getRagStore, type RagIndexStore } from './index-store.server'
import {
  createReranker,
  resolveCosineThreshold,
  resolveRerankMargin,
  resolveRerankThreshold,
} from './reranker.server'
import { createDefaultRewriter } from './rewrite.server'

export type RagRuntime = {
  corpus: CorpusSource
  embedder: Embedder
  store: RagIndexStore
  reranker: Reranker | null
  rewriter: Rewriter | null
  threshold: number
  cosineThreshold: number
  margin: number
}

export type AnswerRuntime = RagRuntime & { llm: AnswerLlm }

export type RagRuntimeOverrides = Partial<RagRuntime>

export type AnswerRuntimeOverrides = Partial<AnswerRuntime>

export async function resolveRuntime(
  overrides: RagRuntimeOverrides = {},
): Promise<RagRuntime> {
  return {
    corpus:
      overrides.corpus ??
      createWikiCorpusSource({ dir: await resolveCorpusDir() }),
    embedder: overrides.embedder ?? createEmbedder(),
    store: overrides.store ?? (await getRagStore()),
    reranker:
      overrides.reranker !== undefined ? overrides.reranker : createReranker(),
    rewriter:
      overrides.rewriter !== undefined
        ? overrides.rewriter
        : createDefaultRewriter(),
    threshold: overrides.threshold ?? resolveRerankThreshold(),
    cosineThreshold: overrides.cosineThreshold ?? resolveCosineThreshold(),
    margin: overrides.margin ?? resolveRerankMargin(),
  }
}

export async function resolveAnswerRuntime(
  overrides: AnswerRuntimeOverrides = {},
): Promise<AnswerRuntime> {
  const base = await resolveRuntime(overrides)
  return { ...base, llm: overrides.llm ?? createDeepSeekAnswerLlm() }
}
