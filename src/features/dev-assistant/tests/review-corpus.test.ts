import { describe, expect, it } from 'vitest'
import {
  isCorpusCodeFile,
  listCodeCorpusFiles,
} from '../server/review-corpus.server'

describe('review corpus', () => {
  it('keeps source files and drops tests, fixtures and declarations', () => {
    expect(isCorpusCodeFile('src/lib/llm.server.ts')).toBe(true)
    expect(isCorpusCodeFile('src/features/dev-assistant/cli/review.ts')).toBe(
      true,
    )
    expect(isCorpusCodeFile('src/features/rag/tests/search.test.ts')).toBe(
      false,
    )
    expect(
      isCorpusCodeFile('src/features/dev-assistant/tests/corpus.test.ts'),
    ).toBe(false)
    expect(isCorpusCodeFile('src/lib/types.d.ts')).toBe(false)
    expect(isCorpusCodeFile('README.md')).toBe(false)
  })

  it('walks the source trees of the repository', async () => {
    const files = await listCodeCorpusFiles(process.cwd())
    expect(files.length).toBeGreaterThan(20)
    expect(files.every((file) => file.group === 'code')).toBe(true)
    expect(files.some((file) => file.path === 'src/lib/llm.server.ts')).toBe(
      true,
    )
    expect(files.some((file) => file.path.includes('/tests/'))).toBe(false)
  })

  it('tolerates a root without source trees', async () => {
    const files = await listCodeCorpusFiles(
      '/nonexistent-root-for-review-corpus',
    )
    expect(files).toEqual([])
  })
})
