import type { AgentTool, SystemBlock } from '../agent'

export type Grounding = 'grounded' | 'ungrounded' | 'no-data'

export type RetrievedSource = {
  chunkId: string
  title: string
  section: string | null
  source: string
  text: string
  score: number
  originalScore?: number
  relevance?: number
}

export type CapabilityContribution = {
  block: SystemBlock | null
  sources: RetrievedSource[]
  tools: AgentTool[]
}

export type CapabilityOutcome = {
  grounding: Grounding
  citations: number[]
}

export type CapabilityTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentCapability = {
  id: string
  prepare(input: {
    query: string
    token: string
    history?: CapabilityTurn[]
  }): Promise<CapabilityContribution>
  classify(answer: string, sources: RetrievedSource[]): CapabilityOutcome
}
