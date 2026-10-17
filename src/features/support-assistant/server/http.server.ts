import { SupportError, isSupportError } from '../domain/errors'

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...headers,
    },
  })
}

export function errorResponse(error: unknown): Response {
  if (isSupportError(error)) {
    const headers: Record<string, string> = {}
    if (error.retryAfterSec !== null) {
      headers['Retry-After'] = String(error.retryAfterSec)
    }
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          retryAfterSec: error.retryAfterSec,
        },
      },
      error.status,
      headers,
    )
  }
  return jsonResponse(
    {
      error: {
        code: 'internal',
        message: 'Внутренняя ошибка сервиса.',
      },
    },
    500,
  )
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SupportError('bad_request', 'Слишком большой запрос.', 413)
  }
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new SupportError('bad_request', 'Слишком большой запрос.', 413)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new SupportError('bad_request', 'Некорректный JSON.', 400)
  }
}
