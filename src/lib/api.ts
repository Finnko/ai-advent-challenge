import type { AgentRunResult, AgentRole } from './agent'
import type { SummaryUsage } from './compression'

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
  createdAt: string
  lastMessage: string
  messageCount: number
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
