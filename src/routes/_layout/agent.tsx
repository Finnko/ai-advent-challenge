import { createFileRoute } from '@tanstack/react-router'
import AgentPage from '@/features/agent/pages/AgentPage'

export const Route = createFileRoute('/_layout/agent')({ component: AgentPage })
