import { describe, expect, it } from 'vitest'
import type { RawDoc } from '../rag-engine.types'
import { createMarkdownChunker, parseMarkdownSections } from './markdown.server'

const DOC: RawDoc = {
  id: 'doc',
  title: 'Doc',
  source: 'doc.md',
  text: [
    '# Title',
    '',
    'Intro paragraph.',
    '',
    '## Section A',
    '',
    'Body A.',
    '',
    '### Sub A1',
    '',
    'Body A1.',
    '',
    '## Section B',
    '',
    'Body B.',
  ].join('\n'),
}

const BIG_SECTION = Array.from(
  { length: 400 },
  (_, index) => `word${index}`,
).join(' ')

const LARGE_DOC: RawDoc = {
  id: 'large',
  title: 'Large',
  source: 'large.md',
  text: `# Title\n\n${BIG_SECTION}\n\n## Second\n\n${BIG_SECTION}\n`,
}

describe('markdown chunker', () => {
  it('parses heading paths', () => {
    const sections = parseMarkdownSections(DOC.text)
    const paths = sections.map((section) => section.path.join(' > '))
    expect(paths).toContain('Title > Section A > Sub A1')
    expect(paths).toContain('Title > Section B')
  })

  it('produces structural chunks with section metadata', () => {
    const chunks = createMarkdownChunker({ id: 'markdown' }).chunk(DOC)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.every((chunk) => chunk.strategy === 'markdown')).toBe(true)
    expect(chunks.every((chunk) => chunk.docId === 'doc')).toBe(true)
    expect(chunks.every((chunk) => chunk.sectionPath.length > 0)).toBe(true)
    expect(chunks.every((chunk) => chunk.nTokens > 0)).toBe(true)
  })

  it('splits oversized sections into several chunks', () => {
    const chunks = createMarkdownChunker({ id: 'markdown' }).chunk(LARGE_DOC)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.nTokens <= 300)).toBe(true)
  })

  it('keeps consumer strategy ids apart', () => {
    const docs = createMarkdownChunker({ id: 'review' }).chunk(DOC)
    const support = createMarkdownChunker({ id: 'support' }).chunk(DOC)
    expect(docs.every((chunk) => chunk.strategy === 'review')).toBe(true)
    expect(support.every((chunk) => chunk.strategy === 'support')).toBe(true)
  })
})
