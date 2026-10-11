import { createFileRoute } from '@tanstack/react-router'
import LlmOptPage from '@/features/llm-opt/pages/LlmOptPage'

export const Route = createFileRoute('/_layout/llm-opt')({
  component: LlmOptPage,
})
