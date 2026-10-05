import type { SystemBlock } from '../agent'
import type { RetrievedSource } from '../capabilities/types'

export const RAG_INSTRUCTION =
  'Ниже фрагменты из базы документов RAG. Если в них есть ответ на вопрос — опирайся только на них и подкрепляй каждый факт ссылкой [n] на использованный фрагмент. Если ответа во фрагментах нет — прямо скажи, что в документах нет данных, и при необходимости продолжай работу своими инструментами.'

export function buildRagBlock(sources: RetrievedSource[]): SystemBlock {
  const lines = sources.map((source, index) => {
    const where = source.section
      ? `${source.title} — ${source.section}`
      : source.title
    return `[${index + 1}] ${where}\n${source.text}`
  })
  return {
    kind: 'rag',
    content: `${RAG_INSTRUCTION}\n\n${lines.join('\n\n')}`,
  }
}

export function formatRagReport(sources: RetrievedSource[]): string {
  return sources
    .map((source, index) => {
      const where = source.section
        ? `${source.title} — ${source.section}`
        : source.title
      return `[${index + 1}] ${where}\n${source.source}\n${source.text}`
    })
    .join('\n\n')
}
