import { countTokens } from 'gpt-tokenizer'
import { resolveChunkingStrategy } from '../domain/chunking/registry'
import type { CorpusRef, CorpusSource } from '../domain/corpus'
import type { Embedder } from '../domain/embedder'
import type { Chunk, ChunkingStrategyId, RawDoc } from '../domain/types'
import type { DocumentRecord, RagIndexStore, StoredChunk } from './index-store.server'

const DEFAULT_LOAD_CONCURRENCY = 3

async function loadDocs(
  refs: CorpusRef[],
  corpus: CorpusSource,
  limit: number,
): Promise<RawDoc[]> {
  const results: RawDoc[] = []
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, refs.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < refs.length) {
      const index = next
      next += 1
      results[index] = await corpus.load(refs[index])
    }
  })
  await Promise.all(workers)
  return results
}

export type BuildIndexResult = {
  strategy: ChunkingStrategyId
  documents: number
  chunks: number
  model: string
  dim: number
  builtAt: string
  durationMs: number
}

export type BuildIndexOptions = {
  strategy: ChunkingStrategyId
  corpus: CorpusSource
  embedder: Embedder
  store: RagIndexStore
  batchSize?: number
  loadConcurrency?: number
  now?: () => Date
}

export async function buildIndex(
  options: BuildIndexOptions,
): Promise<BuildIndexResult> {
  const started = Date.now()
  const now = options.now ?? (() => new Date())
  const batchSize = Math.max(1, options.batchSize ?? 16)
  const strategy = resolveChunkingStrategy(options.strategy)
  const refs = await options.corpus.list()
  const loadConcurrency = options.loadConcurrency ?? DEFAULT_LOAD_CONCURRENCY
  const docs = await loadDocs(refs, options.corpus, loadConcurrency)
  const indexedAt = now().toISOString()

  const chunks: Chunk[] = []
  const docRecords: DocumentRecord[] = []
  for (const doc of docs) {
    chunks.push(...strategy.chunk(doc))
    docRecords.push({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      charCount: doc.text.length,
      nTokens: countTokens(doc.text),
      indexedAt,
    })
  }

  const rows: StoredChunk[] = []
  for (let start = 0; start < chunks.length; start += batchSize) {
    const slice = chunks.slice(start, start + batchSize)
    const embeddings = await options.embedder.embed(
      slice.map((chunk) => chunk.text),
      'passage',
    )
    slice.forEach((chunk, index) => {
      const embedding = embeddings[index]
      if (embedding) {
        rows.push({ chunk, embedding })
      }
    })
  }

  options.store.replaceIndex({
    strategy: options.strategy,
    docs: docRecords,
    rows,
    model: options.embedder.id,
    indexedAt,
  })

  return {
    strategy: options.strategy,
    documents: docs.length,
    chunks: rows.length,
    model: options.embedder.id,
    dim: options.embedder.dim,
    builtAt: indexedAt,
    durationMs: Date.now() - started,
  }
}
