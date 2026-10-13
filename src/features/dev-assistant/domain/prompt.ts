import type { Chunk } from '@lib/rag-engine.types'

export type PromptMessage = {
  role: 'system' | 'user'
  content: string
}

// Same JSON contract as the RAG answer path, so `parseAnswerResponse` /
// `verifyQuotes` can be reused verbatim; only the system prompt differs.
export const ANSWER_FORMAT_INSTRUCTION =
  'Верни строго JSON без markdown и пояснений: {"answer": "ответ, каждый факт о документах со ссылкой [n]", "quotes": [{"n": 1, "text": "дословный фрагмент"}]}.'

const PROJECT_SYSTEM = [
  'Ты — ассистент разработчика проекта ai-advent-challenge (учебный проект про LLM, агентов и RAG).',
  'Отвечай по-русски, по делу и со ссылками на документы.',
  'Ниже даны пронумерованные фрагменты документации проекта и отдельный справочный блок контекста репозитория (текущая git-ветка, статус, коммиты и т. п.).',
  'На вопросы о структуре, фичах, архитектуре, схемах данных и API отвечай, опираясь ТОЛЬКО на фрагменты документации.',
  'Справочный контекст репозитория используй только для вопросов о текущем состоянии (ветка, изменения) и не смешивай его с фактами из документации; его наличие не отменяет ответ по документации.',
  ANSWER_FORMAT_INSTRUCTION,
  'В quotes — только дословные подстроки из фрагментов документации, подтверждающие ответ, с номером n использованного фрагмента.',
  'Если ответа во фрагментах нет, верни {"answer": "в документации проекта нет данных", "quotes": []} и не выдумывай.',
].join(' ')

export function abstainAnswer(question: string): string {
  return `Не знаю: в документации проекта недостаточно данных для ответа на вопрос «${question}». Попробуйте уточнить — например, назовите фичу или ADR.`
}

export function buildChunkBlock(chunks: Chunk[]): string {
  const lines = chunks.map((chunk, index) => {
    const where = chunk.section
      ? `${chunk.title} — ${chunk.section}`
      : chunk.title
    return `[${index + 1}] ${where}\n${chunk.text}`
  })
  return `Фрагменты документации проекта:\n\n${lines.join('\n\n')}`
}

export function buildProjectMessages(input: {
  question: string
  chunks: Chunk[]
  contextBlocks?: string[]
}): PromptMessage[] {
  const parts: string[] = []
  if (input.chunks.length > 0) {
    parts.push(buildChunkBlock(input.chunks))
  }
  const context = (input.contextBlocks ?? []).filter(
    (block) => block.trim().length > 0,
  )
  if (context.length > 0) {
    parts.push(`Справочный контекст репозитория:\n\n${context.join('\n\n')}`)
  }
  parts.push(`Вопрос: ${input.question}`)
  return [
    { role: 'system', content: PROJECT_SYSTEM },
    { role: 'user', content: parts.join('\n\n') },
  ]
}
