import { createFileRoute } from '@tanstack/react-router'
import LocalLlmPage from '@/features/local-llm/pages/LocalLlmPage'

export const Route = createFileRoute('/_layout/local-llm')({
  component: LocalLlmPage,
})
