import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashEmbedder, type Embedder } from '../domain/embedder'
import {
  createLexicalReranker,
  sigmoid,
  type Reranker,
} from '../domain/reranker'
import { parseRewriteResponse, rewriteQuery } from '../domain/rewrite-prompt'
import { optionalThreshold } from '../functions/validation'
import { buildIndex } from '../server/indexing.server'
import {
  createRagStore,
  type RagIndexStore,
} from '../server/index-store.server'
import { retrieve } from '../server/retrieval.server'
import { createFixtureCorpus, makeDoc } from './rag-testkit'

let cleanup: (() => Promise<void>) | null = null

async function makeStore(): Promise<RagIndexStore> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-rerank-'))
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
  makeDoc({
    id: 'alpha',
    title: 'Альфа',
    text: 'Альфа: красная площадь и древний кремль в столице.',
  }),
  makeDoc({
    id: 'beta',
    title: 'Бета',
    text: 'Бета: зелёный парк и краеведческий музей в городе.',
  }),
]

const QUERY = 'зелёный парк музей город'

function rerankByText(
  scores: Record<string, number>,
  fallback = 0.1,
): Reranker {
  return {
    id: 'fake',
    async rerank({ documents }) {
      return documents.map((text) => {
        const entry = Object.entries(scores).find(([needle]) =>
          text.includes(needle),
        )
        return entry ? entry[1] : fallback
      })
    },
  }
}

async function setup(): Promise<{
  store: RagIndexStore
  embedder: ReturnType<typeof createHashEmbedder>
}> {
  const store = await makeStore()
  const embedder = createHashEmbedder(256)
  await buildIndex({
    strategy: 'fixed',
    corpus: createFixtureCorpus(DOCS),
    embedder,
    store,
  })
  return { store, embedder }
}

function tiedEmbedder(dim = 8): Embedder {
  return {
    id: 'tied',
    dim,
    async embed(texts) {
      return texts.map(() => Float32Array.from({ length: dim }, () => 1))
    },
  }
}

async function tiedSetup(): Promise<{
  store: RagIndexStore
  embedder: Embedder
}> {
  const store = await makeStore()
  const embedder = tiedEmbedder()
  await buildIndex({
    strategy: 'fixed',
    corpus: createFixtureCorpus(DOCS),
    embedder,
    store,
  })
  return { store, embedder }
}

describe('retrieve second stage', () => {
  it('reranks candidates and keeps the original cosine score', async () => {
    const { store, embedder } = await setup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 1,
      embedder,
      store,
      reranker: rerankByText({ Альфа: 0.9, Бета: 0.1 }),
      threshold: null,
    })

    expect(result.reranked).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].chunk.title).toBe('Альфа')
    expect(result.results[0].relevance).toBeCloseTo(0.9)
    expect(result.results[0].originalScore).toBeDefined()
    store.close()
  })

  it('drops results below the threshold but keeps at least one', async () => {
    const { store, embedder } = await setup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 5,
      embedder,
      store,
      reranker: rerankByText({ Альфа: 0.9, Бета: 0.1 }),
      threshold: 0.5,
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].chunk.title).toBe('Альфа')
    store.close()
  })

  it('returns the top candidate when everything is below the threshold', async () => {
    const { store, embedder } = await setup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 5,
      embedder,
      store,
      reranker: rerankByText({}, 0.05),
      threshold: 0.9,
    })

    expect(result.results).toHaveLength(1)
    store.close()
  })

  it('fails open to cosine order when the reranker throws', async () => {
    const { store, embedder } = await setup()
    const failing: Reranker = {
      id: 'boom',
      async rerank() {
        throw new Error('boom')
      },
    }
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 5,
      embedder,
      store,
      reranker: failing,
      threshold: 0.9,
    })

    expect(result.reranked).toBe(false)
    expect(result.results[0].chunk.title).toBe('Бета')
    expect(result.results[0].relevance).toBeUndefined()
    store.close()
  })

  it('limits the candidate pool independently of k', async () => {
    const { store, embedder } = await setup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 5,
      candidateK: 1,
      embedder,
      store,
    })

    expect(result.candidateCount).toBe(1)
    expect(result.results).toHaveLength(1)
    store.close()
  })
})

describe('rerank margin guard', () => {
  it('keeps cosine order on a tied cosine when the rerank gap is below the margin', async () => {
    const { store, embedder } = await tiedSetup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 2,
      embedder,
      store,
      reranker: rerankByText({ Бета: 0.976, Альфа: 0.901 }),
      threshold: null,
      margin: 0.1,
    })

    expect(result.reranked).toBe(true)
    expect(result.results[0].chunk.title).toBe('Альфа')
    expect(result.results[0].relevance).toBeCloseTo(0.901)
    store.close()
  })

  it('lets the reranker win when it clears the margin', async () => {
    const { store, embedder } = await tiedSetup()
    const result = await retrieve({
      strategy: 'fixed',
      query: QUERY,
      k: 2,
      embedder,
      store,
      reranker: rerankByText({ Бета: 0.9, Альфа: 0.1 }),
      threshold: null,
      margin: 0.1,
    })

    expect(result.reranked).toBe(true)
    expect(result.results[0].chunk.title).toBe('Бета')
    store.close()
  })
})

describe('reranker helpers', () => {
  it('maps logits through a bounded sigmoid', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5)
    expect(sigmoid(50)).toBeGreaterThan(0.99)
    expect(sigmoid(-50)).toBeLessThan(0.01)
  })

  it('scores lexical overlap for the offline reranker', async () => {
    const reranker = createLexicalReranker()
    const [high, low] = await reranker.rerank({
      query: 'красная площадь кремль',
      documents: ['красная площадь и кремль в столице', 'зелёный парк'],
    })
    expect(high).toBeGreaterThan(low)
  })
})

describe('query rewrite', () => {
  it('parses JSON and plain responses', () => {
    expect(parseRewriteResponse('{"rewritten":"город на Неве"}')).toBe(
      'город на Неве',
    )
    expect(parseRewriteResponse('```json\n{"rewritten":"город"}\n```')).toBe(
      'город',
    )
    expect(parseRewriteResponse('  город на Неве  ')).toBe('город на Неве')
    expect(parseRewriteResponse('')).toBeNull()
  })

  it('falls back to null on no-op, failure or missing rewriter', async () => {
    expect(await rewriteQuery('вопрос', null)).toBeNull()
    expect(await rewriteQuery('вопрос', async () => 'вопрос')).toBeNull()
    expect(
      await rewriteQuery('вопрос', async () => {
        throw new Error('boom')
      }),
    ).toBeNull()
    expect(await rewriteQuery('вопрос', async () => 'новый')).toBe('новый')
  })
})

describe('search validation', () => {
  it('distinguishes an absent threshold from an explicit null', () => {
    expect(optionalThreshold(undefined)).toBeUndefined()
    expect(optionalThreshold(null)).toBeNull()
    expect(optionalThreshold(0.75)).toBe(0.75)
    expect(() => optionalThreshold(2)).toThrow()
  })
})
