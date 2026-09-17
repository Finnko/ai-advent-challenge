import type { PreparedContext } from '../agent'
import type {
  CompressionMessage,
  PreviousSummary,
  Summarize,
  SummaryUsage,
} from '../compression'
import type { ExtractFacts, Fact } from '../facts'

export type ContextStrategyId =
  | 'summary'
  | 'none'
  | 'window'
  | 'facts'
  | 'branch'

export type PrepareInput = {
  rows: CompressionMessage[]
  request: string
  branchLabel?: string
  windowSize?: number
}

export type SummaryCapability = {
  previousSummary: PreviousSummary | null
  summarize: Summarize
  saveSummary: (
    summary: string,
    throughMessageId: number,
  ) => Promise<void> | void
}

export type FactsCapability = {
  facts: Fact[]
  extractFacts: ExtractFacts
  saveFacts: (facts: Fact[]) => Promise<void> | void
}

export type ContextCapabilities = {
  summary: SummaryCapability
  facts: FactsCapability
}

export type PrepareResult = {
  context: PreparedContext
  auxUsage: SummaryUsage | null
}

export type ContextStrategy = {
  id: ContextStrategyId
  prepare(input: PrepareInput): Promise<PrepareResult>
}
