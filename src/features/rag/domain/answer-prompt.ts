import type { AnswerMode, Chunk } from './types'

export type PromptMessage = {
  role: 'system' | 'user'
  content: string
}

const BASE_SYSTEM =
  'Ты — ассистент, который отвечает на вопросы о городах России. Отвечай по-русски, кратко и по существу.'

const BASELINE_SYSTEM = `${BASE_SYSTEM} Если не знаешь точный факт или не уверен, прямо скажи об этом и не выдумывай.`

const RAG_SYSTEM = `${BASE_SYSTEM} Ниже даны пронумерованные фрагменты документов. Опирайся только на них, каждый факт подкрепляй ссылкой [n] на использованный фрагмент. Если ответа в предоставленных фрагментах нет, скажи, что в документах нет данных, и не выдумывай.`

export function systemPromptFor(mode: AnswerMode): string {
  return mode === 'rag' ? RAG_SYSTEM : BASELINE_SYSTEM
}

export function buildContextBlock(chunks: Chunk[]): string {
  const lines = chunks.map((chunk, index) => {
    const where = chunk.section ? `${chunk.title} — ${chunk.section}` : chunk.title
    return `[${index + 1}] ${where}\n${chunk.text}`
  })
  return `Фрагменты документов:\n\n${lines.join('\n\n')}`
}

export function buildAnswerMessages(input: {
  question: string
  mode: AnswerMode
  chunks: Chunk[]
}): PromptMessage[] {
  const system = systemPromptFor(input.mode)
  const user =
    input.mode === 'rag'
      ? `${buildContextBlock(input.chunks)}\n\nВопрос: ${input.question}`
      : `Вопрос: ${input.question}`
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
