import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_LIMIT,
  SUMMARIZE_MAX_SENTENCES,
  SUMMARIZE_MIN_SENTENCES,
} from '../../domain/research/types.ts'
import type { ResearchToolResult, ResearchToolkit } from './tools.ts'

type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function toResponse(result: ResearchToolResult): ToolResponse {
  if (result.ok) {
    return { content: [{ type: 'text', text: result.text }] }
  }
  return {
    content: [{ type: 'text', text: result.text }],
    isError: true,
  }
}

export function registerResearchTools(
  server: McpServer,
  toolkit: ResearchToolkit,
): void {
  server.registerTool(
    'search',
    {
      title: 'Поиск в интернете',
      description:
        'Ищет публичную информацию в интернете (Wikipedia, ru) по поисковому ' +
        'запросу и возвращает до limit результатов: заголовок, ссылку и краткую ' +
        'выдержку. Первый шаг пайплайна поиска. Справочный инструмент.',
      inputSchema: {
        query: z.string().describe('Поисковый запрос'),
        limit: z
          .number()
          .int()
          .min(SEARCH_MIN_LIMIT)
          .max(SEARCH_MAX_LIMIT)
          .optional()
          .describe(
            `Сколько результатов вернуть (${SEARCH_MIN_LIMIT}–${SEARCH_MAX_LIMIT}, по умолчанию 5)`,
          ),
      },
    },
    async (args) => toResponse(await toolkit.search(args)),
  )

  server.registerTool(
    'summarize',
    {
      title: 'Краткое содержание',
      description:
        'Делает краткое содержание переданного текста: до maxSentences самых ' +
        'значимых предложений в исходном порядке. Детерминированное ' +
        'экстрактивное сжатие без обращения к LLM — второй шаг пайплайна. ' +
        'Справочный инструмент.',
      inputSchema: {
        text: z.string().describe('Текст для сжатия'),
        maxSentences: z
          .number()
          .int()
          .min(SUMMARIZE_MIN_SENTENCES)
          .max(SUMMARIZE_MAX_SENTENCES)
          .optional()
          .describe(
            `Сколько предложений оставить (${SUMMARIZE_MIN_SENTENCES}–${SUMMARIZE_MAX_SENTENCES}, по умолчанию 5)`,
          ),
      },
    },
    async (args) => toResponse(await toolkit.summarize(args)),
  )

  server.registerTool(
    'save_to_file',
    {
      title: 'Сохранить отчёт в файл',
      description:
        'Сохраняет переданный текст в файл отчёта по имени name (безопасное имя, ' +
        'расширение .md добавляется автоматически) и возвращает путь. ' +
        'Изменяющий инструмент — финальный шаг пайплайна.',
      inputSchema: {
        name: z.string().describe('Имя отчёта без пути, например euro-usd-report'),
        content: z.string().describe('Текст отчёта для сохранения'),
      },
    },
    async (args) => toResponse(await toolkit.saveToFile(args)),
  )

  server.registerTool(
    'list_reports',
    {
      title: 'Список сохранённых отчётов',
      description:
        'Перечисляет сохранённые отчёты с размером и временем изменения. ' +
        'Если отчётов нет — честно сообщает об этом. Справочный инструмент, ' +
        'подходит для проверки результата.',
    },
    async () => toResponse(await toolkit.listReports()),
  )

  server.registerTool(
    'read_report',
    {
      title: 'Прочитать отчёт',
      description:
        'Возвращает содержимое сохранённого отчёта по имени. ' +
        'Справочный инструмент для проверки результата.',
      inputSchema: {
        name: z.string().describe('Имя отчёта из list_reports'),
      },
    },
    async (args) => toResponse(await toolkit.readReport(args)),
  )
}
