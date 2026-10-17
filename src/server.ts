import './lib/agent-rag.server'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import type { RequestHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'
import { isSupportPublicPath } from '@/features/support-assistant/domain/public-route'
import { resolveSupportPublic } from '@/features/support-assistant/server/config.server'

type ServerEntry = { fetch: RequestHandler<Register> }

function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args)
    },
  }
}

const startFetch = createStartHandler(defaultStreamHandler)

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function withHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const fetch = async (request: Request): Promise<Response> => {
  if (!resolveSupportPublic()) {
    return startFetch(request)
  }
  const { pathname } = new URL(request.url)
  if (!isSupportPublicPath(pathname)) {
    return notFound()
  }
  return withHeaders(await startFetch(request))
}

if (resolveSupportPublic() && process.env.SUPPORT_WARMUP !== '0') {
  void import('@/features/support-assistant/server/warmup.server')
    .then((module) => module.warmUpSupport())
    .catch(() => undefined)
}

export default createServerEntry({ fetch })
