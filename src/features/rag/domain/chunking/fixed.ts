import { parseWikiSections } from '../wikipedia'
import type { ChunkingStrategy } from './types'
import { buildChunks, tokenWindows } from './windows'

export const FIXED_CHUNK_TOKENS = 256
export const FIXED_CHUNK_OVERLAP = 32

export const fixedStrategy: ChunkingStrategy = {
  id: 'fixed',
  chunk(doc) {
    const sections = parseWikiSections(doc.text)
    const windows = tokenWindows(doc.text, {
      size: FIXED_CHUNK_TOKENS,
      overlap: FIXED_CHUNK_OVERLAP,
    })
    return buildChunks(doc, 'fixed', windows, sections)
  },
}
