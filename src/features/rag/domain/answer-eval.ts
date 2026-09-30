import type { AnswerMode, Chunk } from './types'

export type AnswerVerdict = 'correct' | 'partial' | 'wrong' | 'ungrounded'

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

export function verdictFor(input: {
  mode: AnswerMode
  answer: string
  expected: string[]
  expectedSources: string[]
  chunks: Chunk[]
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
  return 'correct'
}
