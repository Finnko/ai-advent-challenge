import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashEmbedder } from '../domain/embedder'
import type { Reranker } from '../domain/reranker'
import type { SearchScope } from '../domain/search-scope'
import { buildIndex } from '../server/indexing.server'
import {
  createRagStore,
  type RagIndexStore,
} from '../server/index-store.server'
import { searchSources } from '../server/search.server'
import { createFixtureCorpus, makeDoc, SAMPLE_WIKI } from './rag-testkit'

let cleanup: (() => Promise<void>) | null = null

async function makeStore(): Promise<RagIndexStore> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-search-'))
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
    text: '== История ==\nКазань основана в 1005 году как пограничная крепость.',
  }),
]

const CORPUS_SCOPE: SearchScope = {
  strategy: 'fixed',
  k: 3,
  rerank: false,
  rewrite: false,
}

async function indexedStore(docs: typeof DOCS = DOCS): Promise<RagIndexStore> {
  const store = await makeStore()
  await buildIndex({
    strategy: 'fixed',
    corpus: createFixtureCorpus(docs),
    embedder: createHashEmbedder(256),
    store,
  })
  return store
}

function fixedReranker(score: number): Reranker {
  return {
    id: 'fixed',
    async rerank(input) {
      return input.documents.map(() => score)
    },
  }
}

describe('searchSources', () => {
  it('reads the confidence from cosine and flags a weak result below the cosine threshold', async () => {
    const store = await indexedStore()

    const outcome = await searchSources({
      scope: CORPUS_SCOPE,
      query: 'Москва столица',
      store,
      embedder: createHashEmbedder(256),
      cosineThreshold: 0.99,
    })

    expect(outcome.reranked).toBe(false)
    expect(outcome.threshold).toBe(0.99)
    expect(outcome.sources.length).toBeGreaterThan(0)
    expect(outcome.weak).toBe(true)
    store.close()
  })

  it('reads the confidence from the reranker and applies the rerank threshold', async () => {
    const store = await indexedStore()

    const outcome = await searchSources({
      scope: { ...CORPUS_SCOPE, rerank: true },
      query: 'Москва столица',
      store,
      embedder: createHashEmbedder(256),
      reranker: fixedReranker(0.8),
      rerankThreshold: 0.5,
      cosineThreshold: 0.99,
    })

    expect(outcome.reranked).toBe(true)
    expect(outcome.confidence).toBe(0.8)
    expect(outcome.threshold).toBe(0.5)
    expect(outcome.weak).toBe(false)
    store.close()
  })

  it('flags the result weak when the reranker scores below its threshold', async () => {
    const store = await indexedStore()

    const outcome = await searchSources({
      scope: { ...CORPUS_SCOPE, rerank: true },
      query: 'Москва столица',
      store,
      embedder: createHashEmbedder(256),
      reranker: fixedReranker(0.2),
      rerankThreshold: 0.5,
      cosineThreshold: 0,
    })

    expect(outcome.confidence).toBe(0.2)
    expect(outcome.weak).toBe(true)
    store.close()
  })

  it('stitches neighbouring chunks only when the scope asks for it', async () => {
    const longBody = Array.from(
      { length: 500 },
      (_, index) => `слово${index}`,
    ).join(' ')
    const store = await indexedStore([
      makeDoc({
        id: 'long',
        title: 'Длинный',
        text: `== Раздел ==\n${longBody}`,
      }),
    ])

    const plain = await searchSources({
      scope: { ...CORPUS_SCOPE, k: 1 },
      query: 'слово250',
      store,
      embedder: createHashEmbedder(256),
    })
    const stitched = await searchSources({
      scope: { ...CORPUS_SCOPE, k: 1, stitch: true },
      query: 'слово250',
      store,
      embedder: createHashEmbedder(256),
    })

    expect(plain.sources).toHaveLength(1)
    expect(stitched.sources.length).toBeGreaterThan(plain.sources.length)
    expect(stitched.sources.some((source) => source.stitched)).toBe(true)
    store.close()
  })
})
