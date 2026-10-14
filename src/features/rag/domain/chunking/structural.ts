import type { DocSection } from '../sections'
import { parseWikiSections } from '../wikipedia'
import type { ChunkingStrategy } from './types'
import { buildChunks, tokenWindows, type WindowSpan } from './windows'

export const STRUCTURAL_MIN_TOKENS = 48
export const STRUCTURAL_MAX_TOKENS = 256

type SectionGroup = {
  start: number
  end: number
  tokens: number
  level: number
}

export type StructuralChunkerOptions = {
  id: string
  parseSections: (text: string) => DocSection[]
  minTokens: number
  maxTokens: number
}

export function createStructuralChunker(
  options: StructuralChunkerOptions,
): ChunkingStrategy {
  const { id, parseSections, minTokens, maxTokens } = options

  const groupSections = (sections: DocSection[]): SectionGroup[] => {
    const groups: SectionGroup[] = []
    for (const section of sections) {
      const last = groups[groups.length - 1]
      const canMerge =
        last !== undefined &&
        last.level > 0 &&
        last.tokens < minTokens &&
        section.level > last.level &&
        last.tokens + section.tokens <= maxTokens
      if (canMerge) {
        last.end = section.end
        last.tokens += section.tokens
        continue
      }
      groups.push({
        start: section.start,
        end: section.end,
        tokens: section.tokens,
        level: section.level,
      })
    }
    return groups
  }

  return {
    id,
    chunk(doc) {
      const sections = parseSections(doc.text)
      const groups = groupSections(sections)
      const spans: WindowSpan[] = []
      for (const group of groups) {
        const text = doc.text.slice(group.start, group.end)
        if (group.tokens <= maxTokens) {
          spans.push({ text, start: group.start, end: group.end })
          continue
        }
        spans.push(
          ...tokenWindows(text, {
            size: maxTokens,
            overlap: 0,
            baseOffset: group.start,
          }),
        )
      }
      return buildChunks(doc, id, spans, sections)
    },
  }
}

export const structuralStrategy = createStructuralChunker({
  id: 'structural',
  parseSections: parseWikiSections,
  minTokens: STRUCTURAL_MIN_TOKENS,
  maxTokens: STRUCTURAL_MAX_TOKENS,
})
