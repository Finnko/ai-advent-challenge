import { createFileRoute } from '@tanstack/react-router'
import DevAssistantPage from '@/features/dev-assistant/pages/DevAssistantPage'

export const Route = createFileRoute('/_layout/dev-assistant')({
  component: DevAssistantPage,
})
