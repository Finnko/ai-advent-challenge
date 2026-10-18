import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/auto-review')({
  component: () => <Outlet />,
})
