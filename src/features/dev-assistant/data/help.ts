import type { CorpusGroup } from './corpus-manifest'
import {
  CORPUS_GROUP_LABELS,
  CORPUS_GROUP_ORDER,
  PROJECT_CORPUS,
  PROJECT_QUESTIONS,
} from './corpus-manifest'

export function helpText(): string {
  const counts = new Map<CorpusGroup, number>()
  for (const file of PROJECT_CORPUS) {
    counts.set(file.group, (counts.get(file.group) ?? 0) + 1)
  }
  const groupLines = CORPUS_GROUP_ORDER.filter((group) =>
    counts.has(group),
  ).map((group) => `• ${CORPUS_GROUP_LABELS[group]}: ${counts.get(group)}`)
  const lines = [
    'Я — ассистент разработчика проекта ai-advent-challenge. Отвечаю по документации проекта и вижу текущее состояние репозитория (ветка, статус, коммиты) через MCP.',
    '',
    `В корпусе ${PROJECT_CORPUS.length} документов:`,
    ...groupLines,
    '',
    'Попробуйте спросить:',
    ...PROJECT_QUESTIONS.map((question) => `— ${question}`),
    '',
    'Пишите вопрос как есть или командой «/help <вопрос>».',
  ]
  return lines.join('\n')
}

export type ParsedInput =
  { kind: 'empty' } | { kind: 'help' } | { kind: 'question'; question: string }

export function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { kind: 'empty' }
  }
  if (trimmed === '/help' || trimmed === '/help?') {
    return { kind: 'help' }
  }
  if (trimmed.startsWith('/help ')) {
    const question = trimmed.slice('/help '.length).trim()
    return question.length === 0
      ? { kind: 'help' }
      : { kind: 'question', question }
  }
  return { kind: 'question', question: trimmed }
}
