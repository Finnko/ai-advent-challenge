import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashEmbedder } from '../domain/embedder'
import type { PromptMessage } from '../domain/answer-prompt'
import { answerQuestion, type AnswerLlm } from '../server/answer.server'
import { buildIndex } from '../server/indexing.server'
import {
  createRagStore,
  type RagIndexStore,
} from '../server/index-store.server'
import { stitchSources } from '../server/retrieval.server'
import { createFixtureCorpus, makeDoc } from './rag-testkit'

let cleanup: (() => Promise<void>) | null = null

async function makeStore(): Promise<RagIndexStore> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-contract-'))
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

const SYNTHETIC = 'Тестоград основан в 2087 году указом номер 517.'

function contextGroundedLlm(): AnswerLlm {
  return async (messages: PromptMessage[]) => {
    const context = messages.map((message) => message.content).join('\n')
    if (!context.includes('Фрагменты документов')) {
      return { content: 'Не знаю.', usage: null, latencyMs: 0 }
    }
    return {
      content:
        '{"answer":"Тестоград основан в 2087 году [1].","quotes":[{"n":1,"text":"основан в 2087 году"}]}',
      usage: null,
      latencyMs: 0,
    }
  }
}

describe('answer contract on synthetic, non-memorized facts', () => {
  it('only the grounded RAG branch can answer a fact absent from training', async () => {
    const store = await makeStore()
    const embedder = createHashEmbedder(256)
    await buildIndex({
      strategy: 'fixed',
      corpus: createFixtureCorpus([
        makeDoc({ id: 'testograd', title: 'Тестоград', text: SYNTHETIC }),
      ]),
      embedder,
      store,
    })
    const deps = { embedder, store, llm: contextGroundedLlm() }

    const baseline = await answerQuestion(
      {
        mode: 'baseline',
        strategy: 'fixed',
        query: SYNTHETIC,
        k: 3,
        expected: ['2087'],
      },
      deps,
    )
    expect(baseline.answer).toBe('Не знаю.')
    expect(baseline.verdict).toBe('wrong')

    const rag = await answerQuestion(
      {
        mode: 'rag',
        strategy: 'fixed',
        query: SYNTHETIC,
        k: 3,
        expected: ['2087'],
        expectedSources: ['Тестоград'],
      },
      deps,
    )
    expect(rag.sources).toHaveLength(1)
    expect(rag.sources[0].chunk.chunkId).toBe('testograd:fixed:0')
    expect(rag.quotes[0].verified).toBe(true)
    expect(rag.abstained).toBe(false)
    expect(rag.verdict).toBe('correct')
    store.close()
  })

  it('stitches neighbouring chunks into the answer context', async () => {
    const store = await makeStore()
    const embedder = createHashEmbedder(256)
    const longText = Array.from({ length: 80 }, () => SYNTHETIC).join(' ')
    await buildIndex({
      strategy: 'fixed',
      corpus: createFixtureCorpus([
        makeDoc({ id: 'testograd', title: 'Тестоград', text: longText }),
      ]),
      embedder,
      store,
    })

    const flagged = await answerQuestion(
      {
        mode: 'rag',
        strategy: 'fixed',
        query: SYNTHETIC,
        k: 1,
        stitch: true,
      },
      { embedder, store, llm: contextGroundedLlm() },
    )
    expect(flagged.sources.length).toBeGreaterThan(1)
    expect(flagged.sources.some((source) => source.stitched)).toBe(true)

    const plain = await answerQuestion(
      { mode: 'rag', strategy: 'fixed', query: SYNTHETIC, k: 1, stitch: false },
      { embedder, store, llm: contextGroundedLlm() },
    )
    expect(plain.sources).toHaveLength(1)
    expect(plain.sources.some((source) => source.stitched)).toBe(false)
    store.close()
  })

  it('stitchSources dedupes and respects the document boundary', async () => {
    const store = await makeStore()
    const embedder = createHashEmbedder(256)
    await buildIndex({
      strategy: 'fixed',
      corpus: createFixtureCorpus([
        makeDoc({ id: 'a', title: 'A', text: 'Альфа кремль площадь.' }),
        makeDoc({ id: 'b', title: 'B', text: 'Бета парк музей.' }),
      ]),
      embedder,
      store,
    })
    const sources = [{ chunk: store.listChunks('fixed')[0], score: 0.9 }]
    const expanded = stitchSources(sources, store, 'fixed')
    const ids = expanded.map((source) => source.chunk.chunkId)
    expect(new Set(ids).size).toBe(ids.length)
    store.close()
  })
})
