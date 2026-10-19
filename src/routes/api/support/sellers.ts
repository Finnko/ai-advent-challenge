import { createFileRoute } from '@tanstack/react-router'
import { getSupportCatalog } from '@/features/support-assistant/server/service.server'
import {
  errorResponse,
  jsonResponse,
} from '@/features/support-assistant/server/http.server'

export const Route = createFileRoute('/api/support/sellers')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return jsonResponse(await getSupportCatalog())
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})
