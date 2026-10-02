import type { RawQuote } from './answer-format'
import type { AnswerMode, Chunk } from './types'

export type AnswerVerdict =
  'correct' | 'partial' | 'wrong' | 'ungrounded' | 'abstained'

export type AnswerQuote = {
  n: number
  text: string
  verified: boolean
  chunkId: string | null
  title: string | null
  section: string | null
}

export function normalizeFact(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchExpected(
  answer: string,
  expected: string[],
): { matched: string[]; missing: string[] } {
  const haystack = normalizeFact(answer)
  const matched: string[] = []
  const missing: string[] = []
  for (const fact of expected) {
    if (haystack.includes(normalizeFact(fact))) {
      matched.push(fact)
    } else {
      missing.push(fact)
    }
  }
  return { matched, missing }
}

export function normalizeQuote(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

export function verifyQuotes(
  quotes: RawQuote[],
  chunks: Chunk[],
): AnswerQuote[] {
  return quotes.map((quote) => {
    const chunk = chunks[quote.n - 1] ?? null
    const haystack = chunk ? normalizeQuote(chunk.text) : ''
    const needle = normalizeQuote(quote.text)
    const verified =
      haystack.length > 0 && needle.length > 0 && haystack.includes(needle)
    return {
      n: quote.n,
      text: quote.text,
      verified,
      chunkId: chunk?.chunkId ?? null,
      title: chunk?.title ?? null,
      section: chunk?.section ?? null,
    }
  })
}

export function parseCitations(answer: string): number[] {
  const found = new Set<number>()
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const value = Number(match[1])
    if (Number.isFinite(value) && value > 0) {
      found.add(value)
    }
  }
  return [...found].sort((a, b) => a - b)
}

export function citedTitles(answer: string, chunks: Chunk[]): string[] {
  const titles = parseCitations(answer)
    .map((index) => chunks[index - 1]?.title)
    .filter((title): title is string => Boolean(title))
  return [...new Set(titles)]
}

function quotesSupportFacts(facts: string[], quotes: AnswerQuote[]): boolean {
  const haystack = normalizeFact(
    quotes
      .filter((quote) => quote.verified)
      .map((quote) => quote.text)
      .join(' '),
  )
  return facts.every((fact) => haystack.includes(normalizeFact(fact)))
}

export function verdictFor(input: {
  mode: AnswerMode
  answer: string
  expected: string[]
  expectedSources: string[]
  chunks: Chunk[]
  quotes?: AnswerQuote[]
}): AnswerVerdict {
  if (input.answer.trim().length === 0) {
    return 'wrong'
  }
  const { matched, missing } = matchExpected(input.answer, input.expected)
  if (matched.length === 0) {
    return 'wrong'
  }
  if (missing.length > 0) {
    return 'partial'
  }
  if (input.mode !== 'rag') {
    return 'correct'
  }
  const cited = citedTitles(input.answer, input.chunks)
  if (cited.length === 0) {
    return 'ungrounded'
  }
  if (
    input.expectedSources.length > 0 &&
    !cited.some((title) => input.expectedSources.includes(title))
  ) {
    return 'ungrounded'
  }
  if (input.quotes !== undefined) {
    const verified = input.quotes.filter((quote) => quote.verified)
    if (verified.length === 0 || !quotesSupportFacts(matched, input.quotes)) {
      return 'ungrounded'
    }
  }
  return 'correct'
}
