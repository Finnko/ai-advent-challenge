import {
  RATE_DEFAULT_BASE,
  RATE_DEFAULT_QUOTE,
  type MarketSource,
} from '../../domain/market/types.ts'
import { errorMessage, fail, ok, type ToolResult } from '../shared/response.ts'

type Args = Record<string, unknown>

export type MarketToolResult = ToolResult

export type MarketToolkitDeps = {
  rates: MarketSource
}

export type MarketToolkit = {
  exchangeRate: (args: Args) => Promise<MarketToolResult>
}

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeCurrency(value: unknown, fallback: string): string | null {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value !== 'string') {
    return null
  }
  const code = value.trim().toUpperCase()
  return CURRENCY_PATTERN.test(code) ? code : null
}

function normalizeDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    return null
  }
  const date = value.trim()
  return DATE_PATTERN.test(date) ? date : null
}

function formatRate(rate: {
  base: string
  quote: string
  rate: number
  date: string
  source: string
}): string {
  const suffix = rate.date
    ? ` (${rate.date}, ${rate.source})`
    : ` (${rate.source})`
  return `1 ${rate.base} = ${rate.rate} ${rate.quote}${suffix}`
}

export function createMarketToolkit(deps: MarketToolkitDeps): MarketToolkit {
  return {
    async exchangeRate(args) {
      const base = normalizeCurrency(args.base, RATE_DEFAULT_BASE)
      const quote = normalizeCurrency(args.quote, RATE_DEFAULT_QUOTE)
      const date = normalizeDate(args.date)
      if (!base) {
        return fail('base должен быть кодом валюты из трёх букв, например EUR.')
      }
      if (!quote) {
        return fail(
          'quote должен быть кодом валюты из трёх букв, например USD.',
        )
      }
      if (date === null) {
        return fail('date должен быть в формате YYYY-MM-DD.')
      }
      if (base === quote) {
        return ok(`1 ${base} = 1 ${quote} (одинаковые валюты).`)
      }
      try {
        const rate = await deps.rates.rate(base, quote, date)
        return ok(formatRate(rate))
      } catch (error) {
        return fail(`Не удалось получить курс: ${errorMessage(error)}`)
      }
    },
  }
}
