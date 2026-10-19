import { createFileRoute } from '@tanstack/react-router'
import { parseAskRequest } from '@/features/support-assistant/domain/validation'
import { SupportError } from '@/features/support-assistant/domain/errors'
import { askSupport } from '@/features/support-assistant/server/ask.server'
import {
  resolveSupportPublic,
  supportConfig,
} from '@/features/support-assistant/server/config.server'
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '@/features/support-assistant/server/http.server'
import {
  extractClientIp,
  supportGate,
  supportLimiter,
} from '@/features/support-assistant/server/metrics.server'
import {
  supportWarmth,
  warmUpSupport,
} from '@/features/support-assistant/server/warmup.server'

export const Route = createFileRoute('/api/support/ask')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readJsonBody(request, supportConfig.maxBodyBytes)
          const parsed = parseAskRequest(body, supportConfig.maxQuestionChars)
          if (!parsed.ok) {
            throw new SupportError('bad_request', parsed.error, 400)
          }
          if (resolveSupportPublic() && !supportWarmth().ready) {
            void warmUpSupport().catch(() => undefined)
            throw new SupportError(
              'warming',
              'Сервис прогревает модель, попробуйте через несколько секунд.',
              503,
              15,
            )
          }
          const ip = extractClientIp(request)
          const decision = supportLimiter.admit(ip)
          if (!decision.allowed) {
            throw new SupportError(
              'too_many_requests',
              'Слишком много запросов. Попробуйте позже.',
              429,
              decision.retryAfterSec,
            )
          }
          const slot = await supportGate.acquire()
          if (!slot.ok) {
            throw new SupportError(
              'busy',
              'Сервис занят, попробуйте через несколько секунд.',
              503,
              5,
            )
          }
          const controller = new AbortController()
          const timer = setTimeout(
            () => controller.abort(),
            supportConfig.timeoutMs,
          )
          try {
            const result = await askSupport(parsed.value, {
              signal: controller.signal,
            })
            return jsonResponse(result)
          } finally {
            clearTimeout(timer)
            slot.slot.release()
          }
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})
