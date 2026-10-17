import {
  createStructuralChunker,
  MARKDOWN_HEADING_RE,
  parseSections,
} from '../rag-engine.server'
import type {
  ChunkingStrategy,
  ChunkingStrategyId,
  DocSection,
} from '../rag-engine.types'

export const MARKDOWN_MIN_TOKENS = 48
export const MARKDOWN_MAX_TOKENS = 256

export type MarkdownChunkerOptions = {
  id: ChunkingStrategyId
  minTokens?: number
  maxTokens?: number
}

export function parseMarkdownSections(text: string): DocSection[] {
  return parseSections(text, MARKDOWN_HEADING_RE)
}

export function createMarkdownChunker(
  options: MarkdownChunkerOptions,
): ChunkingStrategy {
  return createStructuralChunker({
    id: options.id,
    parseSections: parseMarkdownSections,
    minTokens: options.minTokens ?? MARKDOWN_MIN_TOKENS,
    maxTokens: options.maxTokens ?? MARKDOWN_MAX_TOKENS,
  })
}
