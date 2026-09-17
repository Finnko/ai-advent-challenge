import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/agent-memory')({
  beforeLoad: () => {
    throw redirect({ to: '/agent' })
  },
})
