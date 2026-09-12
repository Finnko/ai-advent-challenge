import type { PreparedContext } from '../agent'
import type {
  CompressionMessage,
  PreviousSummary,
  Summarize,
  SummaryUsage,
} from '../compression'

export type ContextStrategyId = 'summary' | 'none'

export type PrepareInput = {
  rows: CompressionMessage[]
  previousSummary: PreviousSummary | null
  summarize: Summarize
  saveSummary: (
    summary: string,
    throughMessageId: number,
  ) => Promise<void> | void
}

export type PrepareResult = {
  context: PreparedContext
  auxUsage: SummaryUsage | null
}

export type ContextStrategy = {
  id: ContextStrategyId
  label: string
  description: string
  prepare(input: PrepareInput): Promise<PrepareResult>
}
