export const RATE_DEFAULT_BASE = 'EUR'
export const RATE_DEFAULT_QUOTE = 'USD'

export type ExchangeRate = {
  base: string
  quote: string
  rate: number
  date: string
  source: string
}

export type MarketSource = {
  rate(base: string, quote: string, date?: string): Promise<ExchangeRate>
}
