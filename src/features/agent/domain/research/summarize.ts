import {
  SUMMARIZE_DEFAULT_SENTENCES,
  SUMMARIZE_MAX_SENTENCES,
  SUMMARIZE_MIN_SENTENCES,
} from './types.ts'

const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+|\n+/u
const WORD_PATTERN = /[a-zа-яё0-9]+/gi
const MIN_WORD_LENGTH = 4

function normalizeSentence(sentence: string): string {
  return sentence.replace(/\s+/g, ' ').trim()
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(SENTENCE_BOUNDARY)
    .map(normalizeSentence)
    .filter((sentence) => sentence.length > 0)
}

function keywords(sentence: string): string[] {
  const matches = sentence.toLowerCase().match(WORD_PATTERN)
  if (!matches) {
    return []
  }
  return matches.filter((word) => word.length >= MIN_WORD_LENGTH)
}

function wordFrequency(sentences: string[]): Map<string, number> {
  const frequency = new Map<string, number>()
  for (const sentence of sentences) {
    for (const word of keywords(sentence)) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
    }
  }
  return frequency
}

function scoreSentence(
  sentence: string,
  frequency: Map<string, number>,
  index: number,
): number {
  const unique = new Set(keywords(sentence))
  let score = 0
  for (const word of unique) {
    score += frequency.get(word) ?? 0
  }
  const weight = Math.sqrt(unique.size || 1)
  return score / weight + 1 / (index + 1)
}

export function clampSummarizeSentences(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return SUMMARIZE_DEFAULT_SENTENCES
  }
  const rounded = Math.round(value)
  if (rounded < SUMMARIZE_MIN_SENTENCES) {
    return SUMMARIZE_MIN_SENTENCES
  }
  if (rounded > SUMMARIZE_MAX_SENTENCES) {
    return SUMMARIZE_MAX_SENTENCES
  }
  return rounded
}

export function summarizeText(text: string, maxSentences: number): string {
  const sentences = splitSentences(text)
  if (sentences.length <= maxSentences) {
    return sentences.join(' ')
  }
  const frequency = wordFrequency(sentences)
  const ranked = sentences.map((sentence, index) => ({
    index,
    sentence,
    score: scoreSentence(sentence, frequency, index),
  }))
  const chosen = [...ranked]
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxSentences)
  return chosen
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.sentence)
    .join(' ')
}
