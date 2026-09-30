import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHashEmbedder } from '../domain/embedder'
import type { PromptMessage } from '../domain/answer-prompt'
import { answerQuestion, type AnswerLlm } from '../server/answer.server'
import { buildIndex } from '../server/indexing.server'
import { createRagStore, type RagIndexStore } from '../server/index-store.server'
import { createFixtureCorpus, makeDoc, SAMPLE_WIKI } from './rag-testkit'

let cleanup: (() => Promise<void>) | null = null

async function makeStore(): Promise<RagIndexStore> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-answer-'))
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

function createFakeLlm(content: string) {
  const calls: PromptMessage[][] = []
  const llm: AnswerLlm = async (messages) => {
    calls.push(messages)
    return {
      content,
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      latencyMs: 2,
    }
  }
  return { llm, calls }
}

async function makeDeps(store: RagIndexStore, llm: AnswerLlm) {
  const embedder = createHashEmbedder(256)
  await buildIndex({
    strategy: 'fixed',
    corpus: createFixtureCorpus(DOCS),
    embedder,
    store,
  })
  return { embedder, store, llm }
}

describe('answerQuestion', () => {
  it('baseline sends no retrieved context', async () => {
    const store = await makeStore()
    const { llm, calls } = createFakeLlm('Не знаю.')
    const deps = await makeDeps(store, llm)

    const result = await answerQuestion(
      {
        mode: 'baseline',
        strategy: 'fixed',
        query: 'столица Татарстана кремль Кул-Шариф',
        k: 3,
      },
      deps,
    )

    expect(result.sources).toEqual([])
    expect(result.verdict).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0][1].content).not.toContain('Фрагменты документов')
    store.close()
  })

  it('rag retrieves context, cites it and scores the verdict', async () => {
    const store = await makeStore()
    const { llm, calls } = createFakeLlm('Казань — столица Татарстана [1].')
    const deps = await makeDeps(store, llm)

    const result = await answerQuestion(
      {
        mode: 'rag',
        strategy: 'fixed',
        query: 'столица Татарстана кремль Кул-Шариф',
        k: 3,
        expected: ['Казань'],
        expectedSources: ['Казань'],
      },
      deps,
    )

    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources[0].chunk.title).toBe('Казань')
    expect(result.verdict).toBe('correct')
    expect(calls[0][1].content).toContain('Фрагменты документов')
    expect(calls[0][1].content).toContain('[1] Казань')
    store.close()
  })

  it('rag fails loudly on an empty index', async () => {
    const store = await makeStore()
    const { llm } = createFakeLlm('что угодно')

    await expect(
      answerQuestion(
        {
          mode: 'rag',
          strategy: 'fixed',
          query: 'столица Татарстана',
          k: 3,
        },
        { embedder: createHashEmbedder(256), store, llm },
      ),
    ).rejects.toThrow(/пуст/)
    store.close()
  })
})
