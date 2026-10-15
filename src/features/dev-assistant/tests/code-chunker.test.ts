import { describe, expect, it } from 'vitest'
import type { RawDoc } from '@lib/rag-engine.types'
import {
  createCodeChunker,
  isCodeSource,
  parseCodeSections,
} from '../server/code-chunker.server'

const SOURCE = [
  "import { foo } from './foo'",
  '',
  'export const NAME = "demo"',
  '',
  'export function greet(who: string): string {',
  '  const inner = 1',
  '  return `hi ${who} ${inner}`',
  '}',
  '',
  'interface Options {',
  '  size: number',
  '}',
  '',
  'export type Mode = "a" | "b"',
].join('\n')

const DOC: RawDoc = {
  id: 'code:demo.ts',
  title: 'demo.ts',
  source: 'src/demo.ts',
  text: SOURCE,
}

describe('code chunker', () => {
  it('recognises code sources by extension', () => {
    expect(isCodeSource('src/lib/a.ts')).toBe(true)
    expect(isCodeSource('src/components/B.tsx')).toBe(true)
    expect(isCodeSource('README.md')).toBe(false)
    expect(isCodeSource('package.json')).toBe(false)
  })

  it('splits a file by top-level declarations only', () => {
    const sections = parseCodeSections(SOURCE)
    const headings = sections.map((section) => section.heading)
    expect(headings[0]).toBe('(шапка файла)')
    expect(headings).toContain('export const NAME = "demo"')
    expect(
      headings.some((heading) => heading?.startsWith('export function greet')),
    ).toBe(true)
    expect(headings).toContain('interface Options {')
    expect(
      headings.some((heading) => heading?.startsWith('export type Mode')),
    ).toBe(true)
    // `const inner` is indented — it must stay inside its function.
    expect(headings).not.toContain('const inner = 1')
  })

  it('produces chunks tagged with the requested strategy', () => {
    const chunks = createCodeChunker('code').chunk(DOC)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.strategy === 'code')).toBe(true)
    expect(chunks.every((chunk) => chunk.docId === DOC.id)).toBe(true)
    expect(chunks.every((chunk) => chunk.sectionPath.length > 0)).toBe(true)
    expect(chunks.every((chunk) => chunk.nTokens > 0)).toBe(true)
  })

  it('windows an oversized declaration', () => {
    const big = Array.from(
      { length: 400 },
      (_, index) => `  const v${index} = ${index}`,
    ).join('\n')
    const doc: RawDoc = {
      id: 'code:big.ts',
      title: 'big.ts',
      source: 'src/big.ts',
      text: `export function big() {\n${big}\n}\n`,
    }
    const chunks = createCodeChunker('code').chunk(doc)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.nTokens <= 300)).toBe(true)
  })
})
