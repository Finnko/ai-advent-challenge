import type { ChunkingStrategy } from '@lib/rag-engine.types'
import { createCodeChunker, isCodeSource } from './code-chunker.server'
import { createMarkdownChunker } from './markdown-chunker.server'

// Day-32 review scope: one index over the project's docs *and* its source code.
// Both chunkers carry the same id (`review`) so `Chunk.strategy`, the chunk ids
// and the store's per-strategy rows all agree; the dispatch happens per
// document, by extension. The id is private — the shared picker still only
// knows `fixed` and `structural`.
export const REVIEW_STRATEGY = 'review'

const markdown = createMarkdownChunker(REVIEW_STRATEGY)
const code = createCodeChunker(REVIEW_STRATEGY)

export const reviewChunker: ChunkingStrategy = {
  id: REVIEW_STRATEGY,
  chunk(doc) {
    return (isCodeSource(doc.source) ? code : markdown).chunk(doc)
  },
}
