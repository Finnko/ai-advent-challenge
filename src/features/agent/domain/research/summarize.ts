import {
  SUMMARIZE_DEFAULT_SENTENCES,
  SUMMARIZE_MAX_SENTENCES,
  SUMMARIZE_MAX_WORDS,
  SUMMARIZE_MIN_SENTENCES,
  VOLUME_NOTE_PREFIX,
} from './types.ts'

const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+|\n+/u
const WORD_PATTERN = /[a-zа-яё0-9]+/gi
const SOURCE_HEADER = /^\s*\d+\.\s+.*https?:\/\//u

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

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0
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

type TextBlock = {
  header: string
  sentences: string[]
}

type Selection =
  | { kind: 'sentences'; budget: number }
  | { kind: 'words'; budget: number }

export type SummarizeBudget =
  | number
  | { sentences?: number; words?: number }

function parseBlocks(text: string): TextBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: TextBlock[] = []
  let current: TextBlock | null = null
  for (const line of lines) {
    if (SOURCE_HEADER.test(line)) {
      if (current) {
        blocks.push(current)
      }
      current = { header: normalizeSentence(line), sentences: [] }
      continue
    }
    if (!current) {
      continue
    }
    current.sentences.push(...splitSentences(line))
  }
  if (current) {
    blocks.push(current)
  }
  if (blocks.length === 0) {
    return [{ header: '', sentences: splitSentences(text) }]
  }
  return blocks
}

function resolveSelection(budget: SummarizeBudget): Selection {
  if (typeof budget === 'number') {
    return { kind: 'sentences', budget: clampSummarizeSentences(budget) }
  }
  if (typeof budget.words === 'number' && Number.isFinite(budget.words)) {
    return {
      kind: 'words',
      budget: Math.min(Math.max(1, Math.round(budget.words)), SUMMARIZE_MAX_WORDS),
    }
  }
  return { kind: 'sentences', budget: clampSummarizeSentences(budget.sentences) }
}

export function volumeNote(
  actualWords: number,
  targetWords: number,
  sourceWords: number,
): string {
  return `${VOLUME_NOTE_PREFIX} ${actualWords} из ${targetWords} слов — источник короче (в исходнике ${sourceWords} слов). Добавь результатов поиска и повтори summarize.]`
}

export function stripVolumeNote(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(VOLUME_NOTE_PREFIX))
    .join('\n')
    .trim()
}

function reached(selection: Selection, sentences: number, words: number): boolean {
  return selection.kind === 'words'
    ? words >= selection.budget
    : sentences >= selection.budget
}

function pickCounts(
  blocks: TextBlock[],
  selection: Selection,
): number[] {
  const counts = blocks.map(() => 0)
  const maxSentences =
    selection.kind === 'words'
      ? blocks.reduce((total, block) => total + block.sentences.length, 0)
      : SUMMARIZE_MAX_SENTENCES
  let sentences = 0
  let words = 0
  for (const [index, block] of blocks.entries()) {
    if (sentences >= maxSentences) {
      break
    }
    if (block.sentences.length === 0) {
      continue
    }
    counts[index] = 1
    sentences += 1
    words += countWords(block.sentences[0])
  }
  let progress = true
  while (sentences < maxSentences && !reached(selection, sentences, words) && progress) {
    progress = false
    for (const [index, block] of blocks.entries()) {
      if (sentences >= maxSentences || reached(selection, sentences, words)) {
        break
      }
      if (counts[index] >= block.sentences.length) {
        continue
      }
      words += countWords(block.sentences[counts[index]])
      counts[index] += 1
      sentences += 1
      progress = true
    }
  }
  return counts
}

function render(blocks: TextBlock[], counts: number[]): string {
  return blocks
    .map((block, index) => {
      if (counts[index] === 0) {
        return ''
      }
      const body = block.sentences.slice(0, counts[index]).join(' ')
      return block.header ? `${block.header} ${body}`.trim() : body
    })
    .filter((part) => part.length > 0)
    .join('\n')
}

export function summarizeText(text: string, budget: SummarizeBudget): string {
  const blocks = parseBlocks(text)
  const selection = resolveSelection(budget)
  const totalSentences = blocks.reduce(
    (total, block) => total + block.sentences.length,
    0,
  )
  const totalWords = blocks.reduce(
    (total, block) => total + block.sentences.reduce((sum, s) => sum + countWords(s), 0),
    0,
  )
  if (selection.kind === 'sentences' && totalSentences <= selection.budget) {
    return render(
      blocks,
      blocks.map((block) => block.sentences.length),
    )
  }
  if (selection.kind === 'words' && totalWords <= selection.budget) {
    return render(
      blocks,
      blocks.map((block) => block.sentences.length),
    )
  }
  return render(blocks, pickCounts(blocks, selection))
}
