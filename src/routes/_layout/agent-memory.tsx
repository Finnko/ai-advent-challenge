import { createFileRoute } from '@tanstack/react-router'
import AgentMemoryPage from '@/features/agent/pages/AgentMemoryPage'

export const Route = createFileRoute('/_layout/agent-memory')({
  component: AgentMemoryPage,
})
