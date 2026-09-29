import { countTokens } from 'gpt-tokenizer'
import type { Chunk, ChunkingStrategyId, RawDoc } from '../types'
import type { WikiSection } from '../wikipedia'
import { findSectionIndex } from '../wikipedia'

export type TokenWindow = {
  text: string
  start: number
  end: number
  tokens: number
}

export type WindowSpan = {
  text: string
  start: number
  end: number
}

type Piece = {
  text: string
  start: number
  end: number
  tokens: number
}

function toPieces(text: string): Piece[] {
  const pieces: Piece[] = []
  const re = /\S+\s*/g
  let match = re.exec(text)
  while (match !== null) {
    pieces.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      tokens: countTokens(match[0]),
    })
    match = re.exec(text)
  }
  return pieces
}

export function tokenWindows(
  text: string,
  options: { size: number; overlap: number; baseOffset?: number },
): TokenWindow[] {
  const size = Math.max(1, options.size)
  const overlap = Math.max(0, Math.min(options.overlap, size - 1))
  const baseOffset = options.baseOffset ?? 0
  const pieces = toPieces(text)
  const windows: TokenWindow[] = []

  let cursor = 0
  while (cursor < pieces.length) {
    let tokens = 0
    let end = cursor
    while (end < pieces.length && tokens < size) {
      tokens += pieces[end].tokens
      end += 1
    }
    const start = pieces[cursor].start
    const stop = pieces[end - 1].end
    windows.push({
      text: text.slice(start, stop),
      start: baseOffset + start,
      end: baseOffset + stop,
      tokens,
    })
    if (end >= pieces.length) {
      break
    }
    if (overlap <= 0) {
      cursor = end
      continue
    }
    let back = end
    let backTokens = 0
    while (back > cursor + 1 && backTokens < overlap) {
      back -= 1
      backTokens += pieces[back].tokens
    }
    cursor = back
  }

  return windows
}

export function buildChunks(
  doc: RawDoc,
  strategy: ChunkingStrategyId,
  spans: WindowSpan[],
  sections: WikiSection[],
): Chunk[] {
  return spans
    .filter((span) => span.text.trim().length > 0)
    .map((span, position) => {
      const startIndex = findSectionIndex(sections, span.start)
      const endIndex = findSectionIndex(
        sections,
        Math.max(span.start, span.end - 1),
      )
      const section = startIndex >= 0 ? sections[startIndex] : null
      return {
        chunkId: `${doc.id}:${strategy}:${position}`,
        strategy,
        docId: doc.id,
        source: doc.source,
        title: doc.title,
        section: section?.heading ?? null,
        sectionPath: section?.path ?? [],
        position,
        charStart: span.start,
        charEnd: span.end,
        nTokens: countTokens(span.text),
        crossesSection: startIndex !== endIndex,
        text: span.text.trim(),
      } satisfies Chunk
    })
}
