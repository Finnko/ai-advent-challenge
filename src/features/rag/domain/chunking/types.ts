import type { Chunk, ChunkingStrategyId, RawDoc } from '../types'

export type ChunkingStrategy = {
  id: ChunkingStrategyId
  chunk(doc: RawDoc): Chunk[]
}
