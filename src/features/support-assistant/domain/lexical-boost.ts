import type { ScoredChunk } from '@lib/rag-engine.types'
import { SUPPORT_LEXICAL_BOOST } from './constants'

const WORD_RE = /[\p{L}\p{N}]+/gu
const SHORT_ACRONYM_RE = /^[A-ZА-ЯЁ]{1,3}$/
const CYRILLIC_RE = /^[а-я]+$/
const LATIN_RE = /^[a-z]+$/
const DIGIT_RE = /\d/

const PREFIX_LENGTH = 4
const MIN_PREFIX_TERM_LENGTH = 4
const MIN_TERM_LENGTH = 3
const MIN_DEPREFIXED_TERM_LENGTH = 8
const MIN_DEPREFIXED_REST_LENGTH = 7
const MAX_COVERAGE = 1

const TEXT_WEIGHT = 1
const TITLE_WEIGHT = 1.5
const SECTION_WEIGHT = 2

const STOPWORDS = new Set(
  'а без бы был была были было быть в вам вас ваш ваша ваше ваши во все всё вы где да для до его ее если есть еще ещё же за зачем здесь и из или им их к как какая какие какое какой когда ко который которая которое которые кто куда ли либо между меня мне можно мой моя мое мои мы на над надо нас наш наша наше наши но нужно о об от откуда отчего перед по под при про с со сколько так также там тебя тем то тоже тот тут ты у уже чем через что чтобы эта эти это этот я почему'.split(
    ' ',
  ),
)

const RUSSIAN_PREFIXES = [
  'недо',
  'пере',
  'под',
  'про',
  'рас',
  'при',
  'от',
  'вы',
  'за',
  'по',
  'на',
].sort((left, right) => right.length - left.length)

type FieldTokens = {
  text: string[]
  title: string[]
  section: string[]
}

type TermMatcher = {
  exact: boolean
  values: string[]
}

type QueryTerm = TermMatcher & {
  idf: number
}

export type LexicalBoostOptions = {
  weight?: number
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/ё/g, 'е')
}

function tokenize(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map(normalizeWord)
}

function prefixOf(value: string): string {
  return value.slice(0, PREFIX_LENGTH)
}

function dePrefixed(value: string): string | null {
  if (!CYRILLIC_RE.test(value) || value.length < MIN_DEPREFIXED_TERM_LENGTH) {
    return null
  }
  for (const prefix of RUSSIAN_PREFIXES) {
    if (!value.startsWith(prefix)) {
      continue
    }
    const rest = value.slice(prefix.length)
    if (rest.length >= MIN_DEPREFIXED_REST_LENGTH) {
      return rest
    }
  }
  return null
}

function isExactTerm(raw: string, value: string): boolean {
  return (
    SHORT_ACRONYM_RE.test(raw) ||
    DIGIT_RE.test(value) ||
    LATIN_RE.test(value) ||
    value.length < MIN_PREFIX_TERM_LENGTH
  )
}

function isNoiseTerm(raw: string, value: string): boolean {
  if (SHORT_ACRONYM_RE.test(raw) || DIGIT_RE.test(value)) {
    return false
  }
  return value.length < MIN_TERM_LENGTH
}

function buildMatchers(query: string): TermMatcher[] {
  const seen = new Set<string>()
  const matchers: TermMatcher[] = []
  for (const raw of query.match(WORD_RE) ?? []) {
    const value = normalizeWord(raw)
    if (isNoiseTerm(raw, value) || seen.has(value)) {
      continue
    }
    const exact = isExactTerm(raw, value)
    if (!exact && STOPWORDS.has(value)) {
      continue
    }
    seen.add(value)
    if (exact) {
      matchers.push({ exact: true, values: [value] })
      continue
    }
    const values = new Set([prefixOf(value)])
    const rest = dePrefixed(value)
    if (rest) {
      values.add(prefixOf(rest))
    }
    matchers.push({ exact: false, values: [...values] })
  }
  return matchers
}

function containsToken(tokens: string[], matcher: TermMatcher): boolean {
  if (matcher.exact) {
    return tokens.includes(matcher.values[0])
  }
  return tokens.some((token) =>
    matcher.values.some((prefix) => token.startsWith(prefix)),
  )
}

function fieldWeight(matcher: TermMatcher, fields: FieldTokens): number {
  if (containsToken(fields.section, matcher)) {
    return SECTION_WEIGHT
  }
  if (containsToken(fields.title, matcher)) {
    return TITLE_WEIGHT
  }
  if (containsToken(fields.text, matcher)) {
    return TEXT_WEIGHT
  }
  return 0
}

function idfOf(matcher: TermMatcher, documents: FieldTokens[]): number {
  const documentFrequency = documents.reduce(
    (count, fields) => count + (fieldWeight(matcher, fields) > 0 ? 1 : 0),
    0,
  )
  return Math.log(1 + documents.length / (1 + documentFrequency))
}

function coverageOf(
  terms: QueryTerm[],
  fields: FieldTokens,
  totalIdf: number,
): number {
  const matched = terms.reduce(
    (sum, term) => sum + term.idf * fieldWeight(term, fields),
    0,
  )
  return Math.min(MAX_COVERAGE, matched / totalIdf)
}

export function boostSources(
  query: string,
  sources: ScoredChunk[],
  options: LexicalBoostOptions = {},
): ScoredChunk[] {
  const weight = options.weight ?? SUPPORT_LEXICAL_BOOST
  const copies: (ScoredChunk & { originalScore: number })[] = sources.map(
    (source) => ({
      ...source,
      originalScore: source.originalScore ?? source.score,
    }),
  )
  if (!Number.isFinite(weight) || weight <= 0 || copies.length === 0) {
    return copies
  }
  const matchers = buildMatchers(query)
  if (matchers.length === 0) {
    return copies
  }
  const documents = copies.map((source) => ({
    text: tokenize(source.chunk.text),
    title: tokenize(source.chunk.title),
    section: tokenize(source.chunk.section ?? ''),
  }))
  const terms: QueryTerm[] = matchers.map((matcher) => ({
    ...matcher,
    idf: idfOf(matcher, documents),
  }))
  const totalIdf = terms.reduce((sum, term) => sum + term.idf, 0)
  if (totalIdf <= 0) {
    return copies
  }
  const ranked = copies.map((source, index) => {
    const coverage = coverageOf(terms, documents[index], totalIdf)
    return {
      index,
      source,
      score: source.originalScore + weight * coverage,
    }
  })
  ranked.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  )
  return ranked.map(({ source, score }) => ({ ...source, score }))
}
