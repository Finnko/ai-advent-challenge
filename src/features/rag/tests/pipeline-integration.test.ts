import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWikiCorpusSource } from '../server/corpus.server'
import { createLocalEmbedder } from '../server/embedder.server'
import { createRagStore } from '../server/index-store.server'
import { buildIndex } from '../server/indexing.server'
import { searchChunks } from '../server/retrieval.server'

const run =
  process.env.RUN_MODEL_TESTS === '1' && process.env.RUN_NETWORK_TESTS === '1'

describe.skipIf(!run)('RAG pipeline (real corpus + real model)', () => {
  it('indexes a Wikipedia article and retrieves it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rag-pipeline-'))
    const store = await createRagStore(join(dir, 'rag.sqlite'))
    try {
      const corpus = createWikiCorpusSource({
        dir,
        cities: [{ id: 'kazan', title: 'Казань' }],
      })
      const embedder = createLocalEmbedder()
      const result = await buildIndex({
        strategy: 'fixed',
        corpus,
        embedder,
        store,
      })
      expect(result.documents).toBe(1)
      expect(result.chunks).toBeGreaterThan(50)

      const [top] = await searchChunks({
        strategy: 'fixed',
        query: 'столица Татарстана кремль Кул-Шариф',
        k: 1,
        embedder,
        store,
      })
      expect(top.chunk.title).toBe('Казань')
    } finally {
      store.close()
      await rm(dir, { recursive: true, force: true })
    }
  }, 600_000)
})
