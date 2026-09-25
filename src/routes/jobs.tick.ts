import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/jobs/tick')({
  server: {
    handlers: {
      GET: async () => {
        const { runJobsTick } = await import(
          '@/features/agent/server/jobs.server'
        )
        const result = await runJobsTick()
        return new Response(result.text, {
          status: result.ok ? 200 : 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      },
    },
  },
})
