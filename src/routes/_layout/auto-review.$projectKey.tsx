import { createFileRoute } from '@tanstack/react-router'
import AutoReviewProjectPage from '@/features/auto-review/pages/AutoReviewProjectPage'

export const Route = createFileRoute('/_layout/auto-review/$projectKey')({
  component: AutoReviewProjectPage,
})
