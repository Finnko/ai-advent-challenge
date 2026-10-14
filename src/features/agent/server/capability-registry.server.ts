import type { AgentCapability } from '../domain/capabilities/types'

const capabilities = new Map<string, AgentCapability>()

export function registerAgentCapability(capability: AgentCapability): void {
  capabilities.set(capability.id, capability)
}

export function getAgentCapabilities(): AgentCapability[] {
  return [...capabilities.values()]
}

export const AGENT_RAG_CAPABILITY_ID = 'rag'
