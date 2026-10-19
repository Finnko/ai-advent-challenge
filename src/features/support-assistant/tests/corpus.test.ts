import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOzonCorpus, parseFrontmatter } from '../server/corpus.server'

const ROOT = fileURLToPath(new URL('../data/fixtures/corpus', import.meta.url))

describe('ozon corpus', () => {
  it('parses quoted frontmatter and keeps the body', () => {
    const parsed = parseFrontmatter(
      '---\ntitle: "Заголовок"\nupdated: "2026-06-11 14:22:52"\n---\n\n# Текст\n',
    )
    expect(parsed.fields.title).toBe('Заголовок')
    expect(parsed.fields.updated).toBe('2026-06-11 14:22:52')
    expect(parsed.body.startsWith('# Текст')).toBe(true)
  })

  it('indexes articles and guides but skips section pages', async () => {
    const corpus = createOzonCorpus({ root: ROOT })
    const refs = await corpus.list()
    expect(refs).toHaveLength(2)
    expect(refs.some((ref) => ref.title.includes('обновлено 2026-06-11'))).toBe(
      true,
    )
    expect(refs.some((ref) => ref.source.includes('seller-edu'))).toBe(true)
    expect(refs.some((ref) => ref.source.includes('docs.ozon.ru'))).toBe(true)
  })

  it('can include sections on demand', async () => {
    const corpus = createOzonCorpus({ root: ROOT, includeSections: true })
    expect(await corpus.list()).toHaveLength(3)
  })

  it('loads a document by id and rejects unknown ids', async () => {
    const corpus = createOzonCorpus({ root: ROOT })
    const refs = await corpus.list()
    const doc = await corpus.load(refs[0])
    expect(doc.text).toContain('Ozon')
    await expect(
      corpus.load({ id: 'missing', title: '', source: '' }),
    ).rejects.toThrow('Неизвестный документ')
  })

  it('deduplicates doc ids and keeps the freshest copy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'support-corpus-'))
    try {
      const kb = join(dir, 'ozon', 'kb')
      await mkdir(kb, { recursive: true })
      await writeFile(
        join(kb, 'old.md'),
        '---\ntitle: Старая\nkind: article\ndoc_id: 42\nupdated: "2026-01-01"\n---\n\n# Старая\n',
      )
      await writeFile(
        join(kb, 'new.md'),
        '---\ntitle: Новая\nkind: article\ndoc_id: 42\nupdated: "2026-02-01"\n---\n\n# Новая\n',
      )
      const corpus = createOzonCorpus({ root: dir })
      const refs = await corpus.list()
      expect(refs).toHaveLength(1)
      expect(refs[0].title).toContain('Новая')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
