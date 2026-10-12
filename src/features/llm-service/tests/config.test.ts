import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_INPUT_TOKENS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_PORT,
  DEFAULT_RPM,
  DEFAULT_TOKENS_PER_MIN,
  parseServiceKeys,
  resolveServiceConfig,
  resolveServiceEndpoint,
} from '../server/config.server'

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv
}

describe('parseServiceKeys', () => {
  it('парсит именованные ключи', () => {
    expect(parseServiceKeys('anna:secret1, boris:secret2')).toEqual([
      { id: 'anna', secret: 'secret1' },
      { id: 'boris', secret: 'secret2' },
    ])
  })

  it('даёт сгенерированное имя ключу без двоеточия', () => {
    expect(parseServiceKeys('raw-key')).toEqual([
      { id: 'key1', secret: 'raw-key' },
    ])
  })

  it('сохраняет двоеточия внутри секрета', () => {
    expect(parseServiceKeys('anna:a:b')).toEqual([
      { id: 'anna', secret: 'a:b' },
    ])
  })

  it('игнорирует пустые записи', () => {
    expect(parseServiceKeys(' , anna:s1 , ')).toEqual([
      { id: 'anna', secret: 's1' },
    ])
    expect(parseServiceKeys(undefined)).toEqual([])
  })
})

describe('resolveServiceConfig', () => {
  it('берёт дефолты', () => {
    const config = resolveServiceConfig(env({}))
    expect(config.port).toBe(DEFAULT_PORT)
    expect(config.rpm).toBe(DEFAULT_RPM)
    expect(config.tokensPerMin).toBe(DEFAULT_TOKENS_PER_MIN)
    expect(config.maxInputTokens).toBe(DEFAULT_MAX_INPUT_TOKENS)
    expect(config.maxOutputTokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS)
    expect(config.keys).toEqual([])
    expect(config.endpoint.model).toBe('mlx-community/Qwen3-8B-4bit')
  })

  it('читает переопределения', () => {
    const config = resolveServiceConfig(
      env({
        LLM_SERVICE_PORT: '9001',
        LLM_SERVICE_RPM: '7',
        LLM_SERVICE_MAX_INPUT_TOKENS: '512',
        LLM_SERVICE_KEYS: 'anna:secret1',
        LLM_SERVICE_MODEL: 'custom-model',
        LOCAL_LLM_BASE_URL: 'http://mac.local:8080/v1',
      }),
    )
    expect(config.port).toBe(9001)
    expect(config.rpm).toBe(7)
    expect(config.maxInputTokens).toBe(512)
    expect(config.keys).toHaveLength(1)
    expect(config.endpoint.model).toBe('custom-model')
    expect(config.endpoint.baseUrl).toBe('http://mac.local:8080/v1')
  })

  it('игнорирует некорректные числа', () => {
    const config = resolveServiceConfig(
      env({ LLM_SERVICE_RPM: '-3', LLM_SERVICE_PORT: 'abc' }),
    )
    expect(config.rpm).toBe(DEFAULT_RPM)
    expect(config.port).toBe(DEFAULT_PORT)
  })

  it('resolveServiceEndpoint отдаёт модель без размышлений', () => {
    expect(resolveServiceEndpoint(env({})).withThinking).toBe(false)
  })
})
