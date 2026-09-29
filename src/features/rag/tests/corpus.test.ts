import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWikiCorpusSource, listCorpusStatus } from '../server/corpus.server'

let cleanup: (() => Promise<void>) | null = null

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'rag-corpus-'))
  cleanup = async () => {
    await rm(dir, { recursive: true, force: true })
  }
  return dir
}

afterEach(async () => {
  if (cleanup) {
    await cleanup()
    cleanup = null
  }
})

function wikiResponse(extract: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      query: { pages: [{ title: 'Тест', extract }] },
    }),
  } as unknown as Response
}

function errorResponse(status: number, headers?: Record<string, string>): Response {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
  } as unknown as Response
}

describe('wiki corpus source', () => {
  it('fetches once and then serves from cache', async () => {
    const dir = await makeDir()
    const fetchImpl = vi.fn(async () => wikiResponse('== Раздел ==\nТекст статьи.'))
    const corpus = createWikiCorpusSource({
      dir,
      cities: [{ id: 'test', title: 'Тест' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const refs = await corpus.list()
    expect(refs).toHaveLength(1)
    const first = await corpus.load(refs[0])
    expect(first.text).toContain('Текст статьи')
    const second = await corpus.load(refs[0])
    expect(second.text).toBe(first.text)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws when the article has no extract', async () => {
    const dir = await makeDir()
    const fetchImpl = vi.fn(async () => wikiResponse(''))
    const corpus = createWikiCorpusSource({
      dir,
      cities: [{ id: 'test', title: 'Тест' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const [ref] = await corpus.list()
    await expect(corpus.load(ref)).rejects.toThrow()
  })

  it('serves a bundled snapshot without network', async () => {
    const dir = await makeDir()
    const fetchImpl = vi.fn(async () => {
      throw new Error('network must not be called for bundled docs')
    })
    const corpus = createWikiCorpusSource({
      dir,
      cities: [{ id: 'voronezh', title: 'Воронеж' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const [ref] = await corpus.list()
    const doc = await corpus.load(ref)
    expect(doc.text.length).toBeGreaterThan(1000)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('has a bundled snapshot for every corpus city', async () => {
    const dir = await makeDir()
    const fetchImpl = vi.fn(async () => {
      throw new Error('network must not be called for bundled docs')
    })
    const corpus = createWikiCorpusSource({
      dir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const refs = await corpus.list()
    expect(refs).toHaveLength(15)
    for (const ref of refs) {
      const doc = await corpus.load(ref)
      expect(doc.text.length).toBeGreaterThan(1000)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('retries on 429 honoring Retry-After then succeeds', async () => {
    const dir = await makeDir()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(wikiResponse('== Раздел ==\nТекст статьи.'))
    const corpus = createWikiCorpusSource({
      dir,
      cities: [{ id: 'test', title: 'Тест' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const [ref] = await corpus.list()
    const doc = await corpus.load(ref)
    expect(doc.text).toContain('Текст статьи')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable statuses', async () => {
    const dir = await makeDir()
    const fetchImpl = vi.fn(async () => errorResponse(400))
    const corpus = createWikiCorpusSource({
      dir,
      cities: [{ id: 'test', title: 'Тест' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const [ref] = await corpus.list()
    await expect(corpus.load(ref)).rejects.toThrow('Wikipedia API 400')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('corpus status', () => {
  it('reports cached documents with char counts', async () => {
    const dir = await makeDir()
    await createWikiCorpusSource({
      dir,
      cities: [{ id: 'test', title: 'Тест' }],
      fetchImpl: (async () => wikiResponse('abcde')) as unknown as typeof fetch,
    }).load({ id: 'test', title: 'Тест', source: 's' })

    const statuses = await listCorpusStatus(dir, [{ id: 'test', title: 'Тест' }])
    expect(statuses[0].cached).toBe(true)
    expect(statuses[0].charCount).toBe(5)
  })

  it('reports bundled snapshots as cached without a cache file', async () => {
    const dir = await makeDir()
    const statuses = await listCorpusStatus(dir, [{ id: 'voronezh', title: 'Воронеж' }])
    expect(statuses[0].cached).toBe(true)
    expect(statuses[0].charCount).toBeGreaterThan(1000)
  })
})
