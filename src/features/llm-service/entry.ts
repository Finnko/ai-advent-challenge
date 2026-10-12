import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import {
  resolveServiceConfig,
  type ServiceConfig,
} from './server/config.server'
import { createGateway } from './server/gateway.server'
import { createRateLimiter, createSemaphore } from './server/policy.server'
import { createUpstream } from './server/upstream.server'
import { createUsageTracker } from './server/usage.server'

const FALLBACK_CHAT_HTML =
  '<!doctype html><meta charset="utf-8"><title>llm-service</title><body><p>Чат-страница не найдена. Проверь LLM_SERVICE_CHAT_PAGE.</p>'

async function loadChatHtml(config: ServiceConfig): Promise<string> {
  const candidate =
    config.chatPagePath ??
    fileURLToPath(new URL('./index.html', import.meta.url))
  try {
    return await readFile(candidate, 'utf8')
  } catch {
    return FALLBACK_CHAT_HTML
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers.set(name, value)
    } else if (Array.isArray(value)) {
      headers.set(name, value.join(', '))
    }
  }
  return headers
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const config = resolveServiceConfig()

if (config.keys.length === 0) {
  console.error(
    'LLM_SERVICE_KEYS не заданы — сервис будет отвечать 401 на все запросы. ' +
      'Добавь ключ в формате name:secret.',
  )
}

const chatHtml = await loadChatHtml(config)
const gateway = createGateway({
  config,
  upstream: createUpstream(config.endpoint),
  limiter: createRateLimiter({
    rpm: config.rpm,
    tokensPerMin: config.tokensPerMin,
    ipRpm: config.ipRpm,
  }),
  semaphore: createSemaphore(1, config.queueDepth, config.queueWaitMs),
  usage: createUsageTracker({ filePath: config.usageLogPath }),
  chatHtml,
})

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const bodyText = await readBody(req)
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    )
    const request = new Request(url, {
      method: req.method ?? 'GET',
      headers: toHeaders(req),
      body: bodyText.length > 0 ? bodyText : undefined,
    })
    const response = await gateway.handle(request)
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    if (!response.body) {
      res.end()
      return
    }
    Readable.fromWeb(response.body as never).pipe(res)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: {
          message: describeError(error),
          type: 'server_error',
          code: null,
        },
      }),
    )
  }
}

const server = createServer((req, res) => {
  void handleRequest(req, res)
})

server.listen(config.port, config.host, () => {
  console.log(`llm-service слушает http://${config.host}:${config.port}`)
  console.log(`модель: ${config.endpoint.model} @ ${config.endpoint.baseUrl}`)
  console.log(
    `ключей: ${config.keys.length}; лимиты: ${config.rpm} rpm / ${config.tokensPerMin} ток/мин, ` +
      `concurrency 1 + очередь ${config.queueDepth}`,
  )
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
  })
}
