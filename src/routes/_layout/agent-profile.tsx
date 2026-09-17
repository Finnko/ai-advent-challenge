import { createFileRoute } from '@tanstack/react-router'
import AgentProfilePage from '@/features/agent/pages/AgentProfilePage'

export const Route = createFileRoute('/_layout/agent-profile')({
  component: AgentProfilePage,
})
