import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildIndex,
  createRagStore,
  type AnswerLlm,
  type RagIndexStore,
} from '@lib/rag-engine.server'
import type { Chunk, Embedder, PromptMessage } from '@lib/rag-engine.types'
import { createProjectCorpus } from '../server/project-corpus.server'
import { REVIEW_STRATEGY, reviewChunker } from '../server/review-chunker.server'
import { reviewPullRequest, REVIEW_MAX_TOKENS } from '../server/review.server'

const CHUNK: Chunk = {
  chunkId: 'code:src/lib/a.ts:review:0',
  strategy: 'review',
  docId: 'code:src/lib/a.ts',
  source: 'src/lib/a.ts',
  title: 'src/lib/a.ts',
  section: 'export function a()',
  sectionPath: ['export function a()'],
  position: 0,
  charStart: 0,
  charEnd: 22,
  nTokens: 4,
  crossesSection: false,
  text: 'export function a() {}',
}

const EMBEDDER: Embedder = {
  id: 'test',
  dim: 4,
  async embed(texts) {
    return texts.map(() => new Float32Array([1, 0, 0, 0]))
  },
}

const REVIEW_JSON = JSON.stringify({
  summary: 'Есть одна проблема.',
  findings: [
    {
      severity: 'bug',
      file: 'src/lib/a.ts',
      line: 1,
      message: 'деление на ноль',
      suggestion: 'проверь знаменатель',
    },
  ],
})

let store: RagIndexStore | null = null
let dir: string | null = null

afterEach(async () => {
  store?.close()
  store = null
  if (dir) {
    await rm(dir, { recursive: true, force: true })
    dir = null
  }
})

describe('reviewPullRequest', () => {
  it('retrieves from the review scope and parses the review contract', async () => {
    dir = await mkdtemp(join(tmpdir(), 'dev-assistant-review-'))
    const current = await createRagStore(join(dir, 'review.sqlite'))
    store = current
    current.replaceIndex({
      strategy: 'review',
      docs: [],
      rows: [{ chunk: CHUNK, embedding: new Float32Array([1, 0, 0, 0]) }],
      model: 'test',
      indexedAt: new Date().toISOString(),
    })

    const calls: PromptMessage[][] = []
    const options: Array<{ json?: boolean; maxTokens?: number }> = []
    const llm: AnswerLlm = async (messages, opts) => {
      calls.push(messages)
      options.push(opts ?? {})
      return {
        content: REVIEW_JSON,
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        latencyMs: 1,
        model: 'test-model',
      }
    }

    const result = await reviewPullRequest({
      store: current,
      generator: 'cloud',
      llm,
      embedder: EMBEDDER,
      contextBlocks: ['### Дифф\n+ const a = 1 / 0'],
    })

    expect(result.report.format).toBe('json')
    expect(result.report.findings[0]).toMatchObject({
      severity: 'bug',
      file: 'src/lib/a.ts',
      line: 1,
    })
    expect(result.sources[0]?.chunk.chunkId).toBe(CHUNK.chunkId)
    expect(result.model).toBe('test-model')
    expect(options[0]).toEqual({ json: true, maxTokens: REVIEW_MAX_TOKENS })

    const [system, user] = calls[0]
    expect(system.content).toContain('ревьюер')
    expect(user.content).toContain('Фрагменты документации и кода проекта')
    expect(user.content).toContain('Контекст pull request')
    expect(user.content).toContain('const a = 1 / 0')
  })

  it('indexes docs and code under the review strategy and answers from it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'dev-assistant-review-corpus-'))
    const root = join(dir, 'repo')
    await mkdir(join(root, 'src/lib'), { recursive: true })
    await writeFile(
      join(root, 'src/lib/a.ts'),
      'export function a() {\n  return 1 / 0\n}\n',
    )
    await writeFile(
      join(root, 'README.md'),
      '# Demo\n\nДокументация проекта.\n',
    )

    const current = await createRagStore(join(dir, 'review.sqlite'))
    store = current
    const result = await buildIndex({
      strategy: REVIEW_STRATEGY,
      chunker: reviewChunker,
      corpus: createProjectCorpus({
        root,
        files: [
          {
            id: 'readme',
            title: 'README.md',
            path: 'README.md',
            group: 'docs',
          },
          {
            id: 'code:src/lib/a.ts',
            title: 'src/lib/a.ts',
            path: 'src/lib/a.ts',
            group: 'code',
          },
        ],
      }),
      embedder: EMBEDDER,
      store: current,
    })

    expect(result.strategy).toBe(REVIEW_STRATEGY)
    expect(result.chunks).toBeGreaterThan(1)
    expect(current.countChunks(REVIEW_STRATEGY)).toBe(result.chunks)

    // Both chunkers tag their output with the one review strategy, so a single
    // retrieval sees documentation and code together.
    const stored = current.listChunks(REVIEW_STRATEGY)
    expect(new Set(stored.map((chunk) => chunk.source))).toEqual(
      new Set(['README.md', 'src/lib/a.ts']),
    )

    const llm: AnswerLlm = async () => ({
      content: REVIEW_JSON,
      usage: null,
      latencyMs: 1,
      model: 'test-model',
    })
    const review = await reviewPullRequest({
      store: current,
      generator: 'cloud',
      llm,
      embedder: EMBEDDER,
      contextBlocks: ['### Дифф\n+ return 1 / 0'],
    })
    expect(review.sources.length).toBeGreaterThan(0)
    expect(review.report.findings).toHaveLength(1)
  })
})
