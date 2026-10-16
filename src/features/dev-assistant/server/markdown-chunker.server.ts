import {
  createStructuralChunker,
  MARKDOWN_HEADING_RE,
  parseSections,
} from '@lib/rag-engine.server'
import type {
  ChunkingStrategy,
  ChunkingStrategyId,
  DocSection,
} from '@lib/rag-engine.types'

export const MARKDOWN_MIN_TOKENS = 48
export const MARKDOWN_MAX_TOKENS = 256

export function parseMarkdownSections(text: string): DocSection[] {
  return parseSections(text, MARKDOWN_HEADING_RE)
}

// Markdown-aware structural chunker: split by headings, merge tiny sections,
// window oversized ones. Private to the feature — it is not registered in the
// shared RAG strategy picker, because it only makes sense for this corpus.
// The id is a parameter so the review pipeline can reuse the same chunker under
// its own `review` strategy while the chat page keeps `markdown`.
export function createMarkdownChunker(
  id: ChunkingStrategyId,
): ChunkingStrategy {
  return createStructuralChunker({
    id,
    parseSections: parseMarkdownSections,
    minTokens: MARKDOWN_MIN_TOKENS,
    maxTokens: MARKDOWN_MAX_TOKENS,
  })
}

export const markdownChunker = createMarkdownChunker('markdown')
