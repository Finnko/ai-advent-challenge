import { describe, expect, it } from 'vitest'
import { PROJECT_CORPUS } from '../data/corpus-manifest'
import { createProjectCorpus } from '../server/project-corpus.server'

describe('project corpus', () => {
  it('points at files that all exist on disk', async () => {
    const corpus = createProjectCorpus({ root: process.cwd() })
    const statuses = await corpus.status(await corpus.list())
    expect(statuses.length).toBe(PROJECT_CORPUS.length)

    const missing = statuses
      .filter((doc) => !doc.cached)
      .map((doc) => doc.source)
    expect(missing).toEqual([])
  })

  it('loads a document from the repository', async () => {
    const corpus = createProjectCorpus({ root: process.cwd() })
    const doc = await corpus.load({
      id: 'readme',
      title: 'README.md',
      source: 'README.md',
    })
    expect(doc.text.length).toBeGreaterThan(100)
    expect(doc.text).toContain('Day')
  })
})
