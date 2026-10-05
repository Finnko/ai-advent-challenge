import type { AgentTool, ToolOutcome } from '../agent'
import { pickString } from '../agent-tools'
import type { RetrievedSource } from '../capabilities/types'
import { formatRagReport } from './prompt'

export const RAG_SEARCH_TOOL = 'rag_search'

export type RagSearch = (query: string) => Promise<RetrievedSource[]>

export function createRagSearchTool(search: RagSearch): AgentTool {
  return {
    name: RAG_SEARCH_TOOL,
    description:
      'Поиск по базе документов RAG. Уточняет запрос по ходу диалога (раскрывает «а он», «там»). Возвращает пронумерованные фрагменты с источниками и URL. Если ничего не найдено — честно сообщает об этом.',
    argsExample: '{ "query": "точный поисковый запрос" }',
    roles: ['employee', 'manager'],
    mutating: false,
    run: async (args): Promise<ToolOutcome> => {
      const query = pickString(args, 'query')
      if (query.length === 0) {
        return { ok: false, text: 'Укажи query для поиска.', reference: null }
      }
      const sources = await search(query)
      if (sources.length === 0) {
        return {
          ok: true,
          text: 'В базе документов ничего релевантного не найдено.',
          reference: null,
        }
      }
      return {
        ok: true,
        text: formatRagReport(sources),
        reference: null,
      }
    },
  }
}
