import type { ExchangeRate, MarketSource } from '../../domain/market/types.ts'

const LATEST_URL = 'https://api.frankfurter.app/latest'
const REQUEST_TIMEOUT_MS = 8000
const SOURCE = 'ECB (Frankfurter)'

type FrankfurterResponse = {
  base?: string
  date?: string
  rates?: Record<string, number>
}

function dailyUrl(date: string): string {
  return `https://api.frankfurter.app/${date}`
}

export function createFrankfurterSource(
  fetchImpl: typeof fetch = fetch,
): MarketSource {
  return {
    async rate(base, quote, date) {
      const from = base.toUpperCase()
      const to = quote.toUpperCase()
      const endpoint = date ? dailyUrl(date) : LATEST_URL
      const params = new URLSearchParams({ from, to })
      const response = await fetchImpl(`${endpoint}?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Frankfurter ${response.status}`)
      }
      const data = (await response.json()) as FrankfurterResponse
      const value = data.rates?.[to]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Frankfurter: нет курса ${from}→${to}`)
      }
      return {
        base: data.base ?? from,
        quote: to,
        rate: value,
        date: data.date ?? date ?? '',
        source: SOURCE,
      } satisfies ExchangeRate
    },
  }
}
