import { countTokens } from 'gpt-tokenizer'
import { createStructuralChunker } from '@lib/rag-engine.server'
import type {
  ChunkingStrategy,
  ChunkingStrategyId,
  DocSection,
} from '@lib/rag-engine.types'

export const CODE_MIN_TOKENS = 48
export const CODE_MAX_TOKENS = 256

const CODE_EXT_RE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i

// A top-level declaration begins at column zero of its own line. Indented
// declarations (inside functions/classes) and commented-out lines never match,
// so the split follows the file's real structure.
const DECL_RE =
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum|namespace)\b/

const HEADING_MAX = 96

export function isCodeSource(source: string): boolean {
  return CODE_EXT_RE.test(source)
}

// Code-aware structural sections: every top-level declaration is a section, the
// imports/docstring above the first one is the file header. Level 0 means the
// shared grouper never merges sections, so a declaration is never glued to a
// neighbour — only oversized ones are windowed.
export function parseCodeSections(text: string): DocSection[] {
  const lines = text.split('\n')
  const boundaries: { start: number; heading: string }[] = []
  let offset = 0
  for (const line of lines) {
    if (line.length > 0 && !/^\s/.test(line) && DECL_RE.test(line)) {
      boundaries.push({
        start: offset,
        heading: line.trim().slice(0, HEADING_MAX),
      })
    }
    offset += line.length + 1
  }
  if (boundaries.length === 0 || (boundaries[0]?.start ?? 0) > 0) {
    boundaries.unshift({ start: 0, heading: '(шапка файла)' })
  }

  const sections: DocSection[] = []
  boundaries.forEach((boundary, index) => {
    const end =
      index + 1 < boundaries.length ? boundaries[index + 1].start : text.length
    const body = text.slice(boundary.start, end)
    if (body.trim().length === 0) {
      return
    }
    sections.push({
      heading: boundary.heading,
      level: 0,
      path: [boundary.heading],
      start: boundary.start,
      end,
      tokens: countTokens(body),
    })
  })
  return sections
}

// Code-aware structural chunker. Like the markdown one it is a private scope
// (its id is never registered in the shared picker); the review index gives it
// the `review` id so docs and code can share one strategy.
export function createCodeChunker(id: ChunkingStrategyId): ChunkingStrategy {
  return createStructuralChunker({
    id,
    parseSections: parseCodeSections,
    minTokens: CODE_MIN_TOKENS,
    maxTokens: CODE_MAX_TOKENS,
  })
}
