import type { AgentRunResult, AgentRole } from './domain/agent'
import type { SummaryUsage } from './domain/compression'
import type { ContextStrategyId } from './domain/context/types'
import type { MemoryEntry } from './domain/memory/types'

export type OrgPerson = {
  token: string
  name: string
  role: AgentRole
  title: string
  managerToken: string | null
}

export type SessionSummary = {
  id: number
  title: string
  strategy: ContextStrategyId
  scenario: string | null
  memoryEnabled: boolean
  createdAt: string
  lastMessage: string
  messageCount: number
}

export type MemoryItem = MemoryEntry

export type MemoryView = {
  working: MemoryItem[]
  longTerm: MemoryItem[]
}

export type RunAgentResult = {
  run: AgentRunResult
  sessionId: number
  auxUsage: SummaryUsage | null
}

export type CompressionComparison = {
  compressed: AgentRunResult
  plain: AgentRunResult
  auxUsage: SummaryUsage | null
}

export type CreateSessionResult = {
  sessionId: number
}

export type BranchInfo = {
  id: number
  sessionId: number
  parentBranchId: number | null
  forkMessageId: number | null
  title: string
  createdAt: string
  isActive: boolean
  messageCount: number
}

export type FactItem = {
  key: string
  value: string
}

export type ScenarioTraceMessage = {
  role: 'user' | 'assistant'
  content: string
  run: AgentRunResult | null
}

export type ScenarioTrace = {
  sessionId: number
  title: string
  strategy: ContextStrategyId
  messages: ScenarioTraceMessage[]
  facts: FactItem[]
}

export type ScenarioComparison = {
  scenario: string
  traces: ScenarioTrace[]
}
