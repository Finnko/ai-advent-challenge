import { createFileRoute } from '@tanstack/react-router'
import { getSupportStatus } from '@/features/support-assistant/server/service.server'
import { jsonResponse } from '@/features/support-assistant/server/http.server'

export const Route = createFileRoute('/api/support/health')({
  server: {
    handlers: {
      GET: async () => {
        const health = await getSupportStatus()
        return jsonResponse(health, health.ok ? 200 : 503)
      },
    },
  },
})
