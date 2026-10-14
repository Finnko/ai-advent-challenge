import { formatNumberedSources } from '@lib/source-format'
import type { SystemBlock } from '../agent'
import type { RetrievedSource } from '../capabilities/types'

export const RAG_INSTRUCTION =
  'Ниже фрагменты из базы документов RAG. Если в них есть ответ на вопрос — опирайся только на них и подкрепляй каждый факт ссылкой [n] на использованный фрагмент. Если ответа во фрагментах нет — прямо скажи, что в документах нет данных, и при необходимости продолжай работу своими инструментами. Вопрос-сравнение («какой раньше / старше / больше»): сначала выпиши значения обоих объектов с номерами [n], затем сравни числа (для дат меньшее значение = раньше/старше), и только после сравнения сформулируй вывод. Не пиши вывода до сравнения и не добавляй утверждений, противоречащих числам.'

export function buildRagBlock(sources: RetrievedSource[]): SystemBlock {
  return {
    kind: 'rag',
    content: formatNumberedSources(sources, { header: RAG_INSTRUCTION }),
  }
}

export function formatRagReport(sources: RetrievedSource[]): string {
  return formatNumberedSources(sources, { withSource: true })
}
