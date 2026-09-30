import { describe, expect, it } from 'vitest'
import type { ExchangeRate, MarketSource } from '../domain/market/types'
import { createFrankfurterSource } from '../mcp/market/rates'
import { createMarketToolkit } from '../mcp/market/tools'
import { mcpServerConfigs } from '../server/mcp-registry.server'

function fakeSource(rate = 1.08): {
  source: MarketSource
  calls: Array<{ base: string; quote: string; date?: string }>
} {
  const calls: Array<{ base: string; quote: string; date?: string }> = []
  const source: MarketSource = {
    async rate(base, quote, date) {
      calls.push({ base, quote, date })
      return {
        base: base.toUpperCase(),
        quote: quote.toUpperCase(),
        rate,
        date: date ?? '2026-09-25',
        source: 'fake',
      } satisfies ExchangeRate
    },
  }
  return { source, calls }
}

describe('market toolkit', () => {
  it('возвращает курс по умолчанию EUR→USD', async () => {
    const { source, calls } = fakeSource(1.08)
    const toolkit = createMarketToolkit({ rates: source })
    const result = await toolkit.exchangeRate({})
    expect(result.ok).toBe(true)
    expect(result.text).toContain('1 EUR = 1.08 USD')
    expect(calls).toEqual([{ base: 'EUR', quote: 'USD', date: undefined }])
  })

  it('нормализует коды и передаёт дату', async () => {
    const { source, calls } = fakeSource(90.5)
    const toolkit = createMarketToolkit({ rates: source })
    const result = await toolkit.exchangeRate({
      base: 'usd',
      quote: 'rub',
      date: '2026-01-02',
    })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('1 USD = 90.5 RUB')
    expect(result.text).toContain('2026-01-02')
    expect(calls).toEqual([{ base: 'USD', quote: 'RUB', date: '2026-01-02' }])
  })

  it('обрабатывает одинаковые валюты без обращения к источнику', async () => {
    const { source, calls } = fakeSource()
    const toolkit = createMarketToolkit({ rates: source })
    const result = await toolkit.exchangeRate({ base: 'EUR', quote: 'eur' })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('1 EUR = 1 EUR')
    expect(calls).toHaveLength(0)
  })

  it('отказывает на некорректных аргументах', async () => {
    const { source } = fakeSource()
    const toolkit = createMarketToolkit({ rates: source })
    expect((await toolkit.exchangeRate({ base: 'euro' })).ok).toBe(false)
    expect((await toolkit.exchangeRate({ quote: '1' })).ok).toBe(false)
    expect((await toolkit.exchangeRate({ date: '25.09.2026' })).ok).toBe(false)
  })

  it('превращает ошибку источника в неуспех', async () => {
    const source: MarketSource = {
      async rate() {
        throw new Error('Frankfurter 500')
      },
    }
    const toolkit = createMarketToolkit({ rates: source })
    const result = await toolkit.exchangeRate({})
    expect(result.ok).toBe(false)
    expect(result.text).toContain('Не удалось получить курс')
  })
})

describe('market frankfurter source', () => {
  it('парсит ответ ЕЦБ', async () => {
    const urls: string[] = []
    const fetchImpl = (async (url: string) => {
      urls.push(url)
      return {
        ok: true,
        async json() {
          return { base: 'EUR', date: '2026-09-25', rates: { USD: 1.09 } }
        },
      }
    }) as unknown as typeof fetch
    const source = createFrankfurterSource(fetchImpl)
    const rate = await source.rate('EUR', 'USD')
    expect(rate).toEqual({
      base: 'EUR',
      quote: 'USD',
      rate: 1.09,
      date: '2026-09-25',
      source: 'ECB (Frankfurter)',
    })
    expect(urls[0]).toContain('frankfurter.app/latest')
    expect(urls[0]).toContain('from=EUR')
    expect(urls[0]).toContain('to=USD')
  })

  it('использует дату в пути', async () => {
    const urls: string[] = []
    const fetchImpl = (async (url: string) => {
      urls.push(url)
      return {
        ok: true,
        async json() {
          return { base: 'EUR', date: '2026-01-02', rates: { USD: 1.05 } }
        },
      }
    }) as unknown as typeof fetch
    const source = createFrankfurterSource(fetchImpl)
    await source.rate('EUR', 'USD', '2026-01-02')
    expect(urls[0]).toContain('frankfurter.app/2026-01-02')
  })
})

describe('market gating and registry', () => {
  it('регистрирует сервер market', () => {
    const market = mcpServerConfigs().find((server) => server.kind === 'market')
    expect(market?.name).toBe('agent-mcp-market')
    expect(market?.hiddenTools).toEqual([])
  })
})

describe.runIf(process.env.RUN_NETWORK_TESTS === '1')('Frankfurter', () => {
  it('отдаёт курс EUR→USD', async () => {
    const source = createFrankfurterSource()
    const rate = await source.rate('EUR', 'USD')
    expect(Number.isFinite(rate.rate)).toBe(true)
  }, 20_000)
})
