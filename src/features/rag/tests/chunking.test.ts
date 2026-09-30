import { describe, expect, it } from 'vitest'
import { fixedStrategy } from '../domain/chunking/fixed'
import { structuralStrategy } from '../domain/chunking/structural'
import { tokenWindows } from '../domain/chunking/windows'
import { findSectionIndex, parseWikiSections } from '../domain/wikipedia'
import { makeDoc, SAMPLE_WIKI } from './rag-testkit'

describe('parseWikiSections', () => {
  it('splits lead and headings with paths', () => {
    const sections = parseWikiSections(SAMPLE_WIKI)
    expect(sections.map((section) => section.heading)).toEqual([
      null,
      'История',
      'Ранняя история',
      'География',
    ])
    expect(sections[2].path).toEqual(['История', 'Ранняя история'])
    expect(sections[3].level).toBe(2)
  })

  it('finds the section containing an offset', () => {
    const sections = parseWikiSections(SAMPLE_WIKI)
    const historyOffset = SAMPLE_WIKI.indexOf('1147')
    expect(sections[findSectionIndex(sections, historyOffset)].heading).toBe(
      'История',
    )
  })
})

describe('tokenWindows', () => {
  it('covers the whole text and overlaps', () => {
    const text = Array.from(
      { length: 120 },
      (_, index) => `слово${index}`,
    ).join(' ')
    const windows = tokenWindows(text, { size: 20, overlap: 5 })
    expect(windows.length).toBeGreaterThan(3)
    expect(windows[0].start).toBe(0)
    expect(windows[windows.length - 1].end).toBe(text.length)
    expect(windows[1].start).toBeLessThan(windows[0].end)
    for (const window of windows) {
      expect(window.tokens).toBeGreaterThan(0)
    }
  })

  it('always advances even with huge overlap', () => {
    const windows = tokenWindows('один два три четыре пять шесть', {
      size: 5,
      overlap: 4,
    })
    expect(windows.length).toBeGreaterThan(0)
    const starts = windows.map((window) => window.start)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })
})

describe('fixedStrategy', () => {
  it('produces ordered chunks with metadata', () => {
    const chunks = fixedStrategy.chunk(makeDoc({ text: SAMPLE_WIKI }))
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].chunkId).toBe('doc-1:fixed:0')
    expect(chunks[0].strategy).toBe('fixed')
    expect(chunks[0].title).toBe('Тест')
    expect(chunks.map((chunk) => chunk.position)).toEqual(
      chunks.map((_, index) => index),
    )
    expect(chunks[chunks.length - 1].charEnd).toBe(SAMPLE_WIKI.length)
  })
})

describe('structuralStrategy', () => {
  it('keeps sections as chunk boundaries', () => {
    const chunks = structuralStrategy.chunk(makeDoc({ text: SAMPLE_WIKI }))
    const headings = chunks.map((chunk) => chunk.section)
    expect(headings).toContain('История')
    expect(headings).toContain('География')
    const sectionStarts = new Set(
      parseWikiSections(SAMPLE_WIKI).map((section) => section.start),
    )
    for (const chunk of chunks) {
      expect(sectionStarts.has(chunk.charStart)).toBe(true)
    }
  })

  it('splits oversized sections but keeps section metadata', () => {
    const body = Array.from(
      { length: 600 },
      (_, index) => `токен${index}`,
    ).join(' ')
    const text = `== Большой раздел ==\n${body}`
    const chunks = structuralStrategy.chunk(makeDoc({ text }))
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.section).toBe('Большой раздел')
    }
  })

  it('handles documents without headings', () => {
    const chunks = structuralStrategy.chunk(
      makeDoc({ text: 'Просто текст без заголовков.' }),
    )
    expect(chunks).toHaveLength(1)
    expect(chunks[0].section).toBeNull()
  })
})
