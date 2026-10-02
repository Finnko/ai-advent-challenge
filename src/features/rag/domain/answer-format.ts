export type RawQuote = {
  n: number
  text: string
}

export type ParsedAnswer = {
  answer: string
  quotes: RawQuote[]
  format: 'json' | 'text'
}

const MAX_QUOTE_LENGTH = 2000

function stripFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
}

function parseQuote(value: unknown): RawQuote | null {
  if (value === null || typeof value !== 'object') {
    return null
  }
  const record = value as { n?: unknown; text?: unknown }
  if (
    typeof record.n !== 'number' ||
    !Number.isFinite(record.n) ||
    record.n < 1 ||
    typeof record.text !== 'string'
  ) {
    return null
  }
  const text = record.text.trim().slice(0, MAX_QUOTE_LENGTH)
  if (text.length === 0) {
    return null
  }
  return { n: Math.trunc(record.n), text }
}

function parseQuotes(value: unknown): RawQuote[] {
  if (!Array.isArray(value)) {
    return []
  }
  const quotes: RawQuote[] = []
  for (const item of value) {
    const quote = parseQuote(item)
    if (quote) {
      quotes.push(quote)
    }
  }
  return quotes
}

export function parseAnswerResponse(content: string): ParsedAnswer {
  const cleaned = stripFences(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return { answer: content.trim(), quotes: [], format: 'text' }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { answer: content.trim(), quotes: [], format: 'text' }
  }
  const record = parsed as { answer?: unknown; quotes?: unknown }
  const answer = typeof record.answer === 'string' ? record.answer.trim() : ''
  return { answer, quotes: parseQuotes(record.quotes), format: 'json' }
}
