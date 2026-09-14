import { createFileRoute } from '@tanstack/react-router'
import AgentStrategiesPage from '../../features/agent/pages/AgentStrategiesPage'

export const Route = createFileRoute('/_layout/agent-strategies')({
  component: AgentStrategiesPage,
})
