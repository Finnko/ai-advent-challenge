import { parseWikiSections, type WikiSection } from '../wikipedia'
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

function groupSections(sections: WikiSection[]): SectionGroup[] {
  const groups: SectionGroup[] = []
  for (const section of sections) {
    const last = groups[groups.length - 1]
    const canMerge =
      last !== undefined &&
      last.level > 0 &&
      last.tokens < STRUCTURAL_MIN_TOKENS &&
      section.level > last.level &&
      last.tokens + section.tokens <= STRUCTURAL_MAX_TOKENS
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

export const structuralStrategy: ChunkingStrategy = {
  id: 'structural',
  chunk(doc) {
    const sections = parseWikiSections(doc.text)
    const groups = groupSections(sections)
    const spans: WindowSpan[] = []
    for (const group of groups) {
      const text = doc.text.slice(group.start, group.end)
      if (group.tokens <= STRUCTURAL_MAX_TOKENS) {
        spans.push({ text, start: group.start, end: group.end })
        continue
      }
      spans.push(
        ...tokenWindows(text, {
          size: STRUCTURAL_MAX_TOKENS,
          overlap: 0,
          baseOffset: group.start,
        }),
      )
    }
    return buildChunks(doc, 'structural', spans, sections)
  },
}
