import {
  assertIndexBuilt,
  buildIndex,
  createEmbedder,
  resolveEmbedModelId,
  type BuildIndexResult,
  type DocumentRecord,
  type RagIndexStore,
} from '@lib/rag-engine.server'
import { SUPPORT_STRATEGY } from '../domain/constants'
import { supportChunker } from './chunker.server'
import { createOzonCorpus, resolveCorpusRoot } from './corpus.server'
import { getSupportStore } from './store.server'

export type SupportIndexStats = {
  documents: DocumentRecord[]
  chunkCount: number
  model: string | null
  builtAt: string | null
  dim: number
  embedModel: string
}

export async function buildSupportIndex(): Promise<BuildIndexResult> {
  const store = await getSupportStore()
  return buildIndex({
    strategy: SUPPORT_STRATEGY,
    chunker: supportChunker,
    corpus: createOzonCorpus({ root: resolveCorpusRoot() }),
    embedder: createEmbedder(),
    store,
  })
}

export function assertSupportIndex(store: RagIndexStore): void {
  assertIndexBuilt(store, SUPPORT_STRATEGY)
}

export async function getSupportIndexStats(): Promise<SupportIndexStats> {
  const store = await getSupportStore()
  return {
    documents: store.listDocuments(),
    chunkCount: store.countChunks(SUPPORT_STRATEGY),
    model: store.getMeta(`${SUPPORT_STRATEGY}.model`),
    builtAt: store.getMeta(`${SUPPORT_STRATEGY}.built_at`),
    dim: Number(store.getMeta(`${SUPPORT_STRATEGY}.dim`) ?? 0),
    embedModel: resolveEmbedModelId(),
  }
}
