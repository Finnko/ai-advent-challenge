import type { CorpusGroup } from './corpus-manifest'
import {
  CORPUS_GROUP_LABELS,
  PROJECT_CORPUS,
  PROJECT_QUESTIONS,
} from './corpus-manifest'

export function helpText(): string {
  const counts: Record<CorpusGroup, number> = { docs: 0, adr: 0, schema: 0 }
  for (const file of PROJECT_CORPUS) {
    counts[file.group] += 1
  }
  const lines = [
    'Я — ассистент разработчика проекта ai-advent-challenge. Отвечаю по документации проекта и вижу текущее состояние репозитория (ветка, статус, коммиты) через MCP.',
    '',
    `В корпусе ${PROJECT_CORPUS.length} документов:`,
    `• ${CORPUS_GROUP_LABELS.docs}: ${counts.docs}`,
    `• ${CORPUS_GROUP_LABELS.adr}: ${counts.adr}`,
    `• ${CORPUS_GROUP_LABELS.schema}: ${counts.schema}`,
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
