import { countTokens } from 'gpt-tokenizer'
import { buildChunks, tokenWindows } from '@lib/rag-engine.server'
import type {
  ChunkingStrategy,
  Section,
  WindowSpan,
} from '@lib/rag-engine.types'

export const MARKDOWN_MIN_TOKENS = 48
export const MARKDOWN_MAX_TOKENS = 256

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

// Same shape as the RAG `parseWikiSections`, but for `#`-headings: the
// dev-assistant corpus is markdown (README, ADRs, feature docs), not wiki text.
export function parseMarkdownSections(text: string): Section[] {
  const sections: Section[] = []
  const stack: { heading: string; level: number }[] = []
  let current: {
    heading: string | null
    level: number
    path: string[]
    start: number
  } = { heading: null, level: 0, path: [], start: 0 }

  const flush = (end: number) => {
    const body = text.slice(current.start, end)
    if (body.trim().length > 0) {
      sections.push({
        heading: current.heading,
        level: current.level,
        path: current.path,
        start: current.start,
        end,
        tokens: countTokens(body),
      })
    }
  }

  const lines = text.split('\n')
  let offset = 0
  for (const line of lines) {
    const match = HEADING_RE.exec(line)
    if (match) {
      flush(offset)
      const level = match[1].length
      const heading = match[2]
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      stack.push({ heading, level })
      current = {
        heading,
        level,
        path: stack.map((item) => item.heading),
        start: offset,
      }
    }
    offset += line.length + 1
  }
  flush(text.length)
  return sections
}

type SectionGroup = {
  start: number
  end: number
  tokens: number
  level: number
}

function groupSections(sections: Section[]): SectionGroup[] {
  const groups: SectionGroup[] = []
  for (const section of sections) {
    const last = groups[groups.length - 1]
    const canMerge =
      last !== undefined &&
      last.level > 0 &&
      last.tokens < MARKDOWN_MIN_TOKENS &&
      section.level > last.level &&
      last.tokens + section.tokens <= MARKDOWN_MAX_TOKENS
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

// Markdown-aware structural chunker: split by headings, merge tiny sections,
// window oversized ones. Private to the feature — it is not registered in the
// shared RAG strategy picker, because it only makes sense for this corpus.
export const markdownChunker: ChunkingStrategy = {
  id: 'structural',
  chunk(doc) {
    const sections = parseMarkdownSections(doc.text)
    const groups = groupSections(sections)
    const spans: WindowSpan[] = []
    for (const group of groups) {
      const text = doc.text.slice(group.start, group.end)
      if (group.tokens <= MARKDOWN_MAX_TOKENS) {
        spans.push({ text, start: group.start, end: group.end })
        continue
      }
      spans.push(
        ...tokenWindows(text, {
          size: MARKDOWN_MAX_TOKENS,
          overlap: 0,
          baseOffset: group.start,
        }),
      )
    }
    return buildChunks(doc, 'structural', spans, sections)
  },
}
