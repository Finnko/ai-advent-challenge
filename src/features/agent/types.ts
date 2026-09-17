import type { AgentRunResult, AgentRole } from './domain/agent'
import type { SummaryUsage } from './domain/compression'
import type { ContextStrategyId } from './domain/context/types'
import type { MemoryEntry } from './domain/memory/types'
import type { ProfileRecord } from './domain/profile/types'

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
  profileId: number | null
  profileName: string | null
  windowSize: number
  taskStateEnabled: boolean
  invariantSetId: number | null
  createdAt: string
  lastMessage: string
  messageCount: number
}

export type ProfileItem = ProfileRecord

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
