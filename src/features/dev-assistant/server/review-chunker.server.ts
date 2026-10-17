import type { ChunkingStrategy } from '@lib/rag-engine.types'
import { createMarkdownChunker } from '@lib/chunking/markdown.server'
import { createCodeChunker, isCodeSource } from './code-chunker.server'

export const REVIEW_STRATEGY = 'review'

const markdown = createMarkdownChunker({ id: REVIEW_STRATEGY })
const code = createCodeChunker(REVIEW_STRATEGY)

export const reviewChunker: ChunkingStrategy = {
  id: REVIEW_STRATEGY,
  chunk(doc) {
    return (isCodeSource(doc.source) ? code : markdown).chunk(doc)
  },
}
