import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashEmbedder } from '../domain/embedder'
import { CHUNKING_STRATEGY_IDS } from '../domain/chunking/registry'
import type { CorpusSource } from '../domain/corpus'
import { compareStrategies, evaluateStrategy } from '../server/comparison.server'
import { createRagStore, type RagIndexStore } from '../server/index-store.server'
import { buildIndex } from '../server/indexing.server'
import { searchChunks } from '../server/retrieval.server'
import { createFixtureCorpus, makeDoc, SAMPLE_WIKI } from './rag-testkit'

let cleanup: (() => Promise<void>) | null = null

async function makeStore(): Promise<RagIndexStore> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-store-'))
  cleanup = async () => {
    await rm(dir, { recursive: true, force: true })
  }
  return createRagStore(join(dir, 'rag.sqlite'))
}

afterEach(async () => {
  if (cleanup) {
    await cleanup()
    cleanup = null
  }
})

const DOCS = [
  makeDoc({ id: 'moscow', title: 'Москва', text: SAMPLE_WIKI }),
  makeDoc({
    id: 'kazan',
    title: 'Казань',
    text: 'Казань — столица Татарстана. В городе находится кремль и мечеть Кул-Шариф.',
  }),
]

describe('indexing pipeline', () => {
  it('builds an index for each strategy and persists metadata', async () => {
    const store = await makeStore()
    const corpus = createFixtureCorpus(DOCS)
    const embedder = createHashEmbedder(128)

    for (const strategy of CHUNKING_STRATEGY_IDS) {
      const result = await buildIndex({ strategy, corpus, embedder, store })
      expect(result.documents).toBe(2)
      expect(result.chunks).toBeGreaterThan(0)
      expect(store.countChunks(strategy)).toBe(result.chunks)
    }

    expect(store.listDocuments()).toHaveLength(2)
    expect(store.getMeta('fixed.model')).toBe(embedder.id)
    expect(store.getMeta('fixed.built_at')).not.toBeNull()
    store.close()
  })

  it('rebuilding a strategy replaces its chunks', async () => {
    const store = await makeStore()
    const corpus = createFixtureCorpus(DOCS)
    const embedder = createHashEmbedder(128)
    const first = await buildIndex({ strategy: 'fixed', corpus, embedder, store })
    const second = await buildIndex({ strategy: 'fixed', corpus, embedder, store })
    expect(store.countChunks('fixed')).toBe(second.chunks)
    expect(first.chunks).toBe(second.chunks)
    store.close()
  })

  it('loads corpus documents with bounded concurrency', async () => {
    const store = await makeStore()
    const embedder = createHashEmbedder(64)
    const docs = Array.from({ length: 7 }, (_, index) =>
      makeDoc({ id: `doc-${index}`, title: `Док ${index}` }),
    )
    let inFlight = 0
    let maxInFlight = 0
    const corpus: CorpusSource = {
      async list() {
        return docs.map((doc) => ({ id: doc.id, title: doc.title, source: doc.source }))
      },
      async load(ref) {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        const doc = docs.find((candidate) => candidate.id === ref.id)
        if (!doc) {
          throw new Error(`Нет документа ${ref.id}`)
        }
        return doc
      },
    }

    await buildIndex({
      strategy: 'fixed',
      corpus,
      embedder,
      store,
      loadConcurrency: 3,
    })

    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBeGreaterThan(1)
    expect(store.listDocuments()).toHaveLength(docs.length)
    store.close()
  })
})

describe('retrieval', () => {
  it('ranks the relevant document first', async () => {
    const store = await makeStore()
    const corpus = createFixtureCorpus(DOCS)
    const embedder = createHashEmbedder(256)
    await buildIndex({ strategy: 'fixed', corpus, embedder, store })

    const results = await searchChunks({
      strategy: 'fixed',
      query: 'столица Татарстана кремль Кул-Шариф',
      k: 3,
      embedder,
      store,
    })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].chunk.title).toBe('Казань')
    store.close()
  })
})

describe('comparison', () => {
  it('evaluates both strategies', async () => {
    const store = await makeStore()
    const corpus = createFixtureCorpus(DOCS)
    const embedder = createHashEmbedder(256)
    for (const strategy of CHUNKING_STRATEGY_IDS) {
      await buildIndex({ strategy, corpus, embedder, store })
    }

    const comparison = await compareStrategies({ embedder, store })
    expect(comparison.strategies).toHaveLength(2)
    for (const entry of comparison.strategies) {
      expect(entry.structural.chunkCount).toBeGreaterThan(0)
      expect(entry.retrieval.queryCount).toBeGreaterThan(0)
    }
    store.close()
  })

  it('reports zero metrics when an index is empty', async () => {
    const store = await makeStore()
    const embedder = createHashEmbedder(64)
    const entry = await evaluateStrategy({ strategy: 'fixed', embedder, store })
    expect(entry.structural.chunkCount).toBe(0)
    expect(entry.retrieval.mrr).toBe(0)
    store.close()
  })
})
