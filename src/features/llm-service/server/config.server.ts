import type { CompletionEndpoint } from '@lib/llm'

export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 8088
export const DEFAULT_RPM = 20
export const DEFAULT_TOKENS_PER_MIN = 20_000
export const DEFAULT_MAX_INPUT_TOKENS = 4096
export const DEFAULT_MAX_OUTPUT_TOKENS = 1024
export const DEFAULT_QUEUE_DEPTH = 4
export const DEFAULT_IP_RPM = 60
export const DEFAULT_TEMPERATURE = 0.6
export const DEFAULT_QUEUE_WAIT_MS = 15_000
export const DEFAULT_USAGE_LOG =
  '~/.ai-advent-challenge/llm-service/usage.jsonl'

export type ServiceKey = {
  id: string
  secret: string
}

export type ServiceConfig = {
  host: string
  port: number
  keys: ServiceKey[]
  rpm: number
  tokensPerMin: number
  ipRpm: number
  maxInputTokens: number
  maxOutputTokens: number
  queueDepth: number
  queueWaitMs: number
  defaultTemperature: number
  endpoint: CompletionEndpoint
  chatPagePath: string | null
  usageLogPath: string | null
}

export function parseServiceKeys(raw: string | undefined): ServiceKey[] {
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => {
      const separator = entry.indexOf(':')
      if (separator === -1) {
        return { id: `key${index + 1}`, secret: entry }
      }
      const id = entry.slice(0, separator).trim() || `key${index + 1}`
      return { id, secret: entry.slice(separator + 1).trim() }
    })
    .filter((key) => key.secret.length > 0)
}

function readInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name]?.trim()
  if (!raw) {
    return fallback
  }
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function readTemperature(env: NodeJS.ProcessEnv): number {
  const raw = env.LLM_SERVICE_TEMPERATURE?.trim()
  if (!raw) {
    return DEFAULT_TEMPERATURE
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 2) {
    return DEFAULT_TEMPERATURE
  }
  return value
}

function readString(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: string,
): string {
  return env[name]?.trim() || fallback
}

export function resolveServiceEndpoint(
  env: NodeJS.ProcessEnv = process.env,
): CompletionEndpoint {
  const baseUrl = env.LOCAL_LLM_BASE_URL?.trim() || 'http://127.0.0.1:8080/v1'
  const model =
    env.LLM_SERVICE_MODEL?.trim() ||
    env.LOCAL_LLM_MODEL?.trim() ||
    'mlx-community/Qwen3-8B-4bit'
  return { baseUrl, model, withThinking: false }
}

export function resolveServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServiceConfig {
  const chatPagePath = env.LLM_SERVICE_CHAT_PAGE?.trim()
  const usageLogPath = env.LLM_SERVICE_USAGE_LOG?.trim()
  return {
    host: readString(env, 'LLM_SERVICE_HOST', DEFAULT_HOST),
    port: readInt(env, 'LLM_SERVICE_PORT', DEFAULT_PORT),
    keys: parseServiceKeys(env.LLM_SERVICE_KEYS),
    rpm: readInt(env, 'LLM_SERVICE_RPM', DEFAULT_RPM),
    tokensPerMin: readInt(
      env,
      'LLM_SERVICE_TOKENS_PER_MIN',
      DEFAULT_TOKENS_PER_MIN,
    ),
    ipRpm: readInt(env, 'LLM_SERVICE_IP_RPM', DEFAULT_IP_RPM),
    maxInputTokens: readInt(
      env,
      'LLM_SERVICE_MAX_INPUT_TOKENS',
      DEFAULT_MAX_INPUT_TOKENS,
    ),
    maxOutputTokens: readInt(
      env,
      'LLM_SERVICE_MAX_OUTPUT_TOKENS',
      DEFAULT_MAX_OUTPUT_TOKENS,
    ),
    queueDepth: readInt(env, 'LLM_SERVICE_QUEUE_DEPTH', DEFAULT_QUEUE_DEPTH),
    queueWaitMs: readInt(
      env,
      'LLM_SERVICE_QUEUE_WAIT_MS',
      DEFAULT_QUEUE_WAIT_MS,
    ),
    defaultTemperature: readTemperature(env),
    endpoint: resolveServiceEndpoint(env),
    chatPagePath: chatPagePath ?? null,
    usageLogPath:
      usageLogPath === '' ? null : (usageLogPath ?? DEFAULT_USAGE_LOG),
  }
}
