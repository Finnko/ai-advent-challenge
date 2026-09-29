import { createFileRoute } from '@tanstack/react-router'
import RagPage from '@/features/rag/pages/RagPage'

export const Route = createFileRoute('/_layout/rag')({ component: RagPage })
