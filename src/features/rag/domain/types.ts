export type ChunkingStrategyId = 'fixed' | 'structural'

export type AnswerMode = 'rag' | 'baseline'

export type RawDoc = {
  id: string
  title: string
  source: string
  text: string
}

export type Chunk = {
  chunkId: string
  strategy: ChunkingStrategyId
  docId: string
  source: string
  title: string
  section: string | null
  sectionPath: string[]
  position: number
  charStart: number
  charEnd: number
  nTokens: number
  crossesSection: boolean
  text: string
}

export type ScoredChunk = {
  chunk: Chunk
  score: number
  originalScore?: number
  relevance?: number
  stitched?: boolean
}
