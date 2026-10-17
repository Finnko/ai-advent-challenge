import { createFileRoute } from '@tanstack/react-router'
import AutoReviewListPage from '@/features/auto-review/pages/AutoReviewListPage'

export const Route = createFileRoute('/_layout/auto-review/')({
  component: AutoReviewListPage,
})
