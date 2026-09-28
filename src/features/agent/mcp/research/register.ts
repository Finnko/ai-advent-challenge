import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_LIMIT,
  SUMMARIZE_MAX_SENTENCES,
  SUMMARIZE_MIN_SENTENCES,
} from '../../domain/research/types.ts'
import { toResponse } from '../shared/response.ts'
import type { ResearchToolkit } from './tools.ts'

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
        'запросу и возвращает до limit результатов: заголовок, ссылку и текст ' +
        'статьи (по умолчанию вводный лид; при full = true — расширенный ' +
        'фрагмент статьи). Первый шаг пайплайна поиска; его вывод передавай в ' +
        'summarize дословно. Если нужен большой объём отчёта — вызывай search ' +
        'с full = true и/или большим limit, при необходимости несколько раз, и ' +
        'склеивай результаты. Справочный инструмент.',
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
        full: z
          .boolean()
          .optional()
          .describe(
            'Вернуть расширенный фрагмент статьи, а не только лид. Используй, когда нужен большой объём источника.',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.search(args)),
  )

  server.registerTool(
    'summarize',
    {
      title: 'Краткое содержание',
      description:
        'Сжимает переданный текст, выбирая связные предложения в исходном ' +
        'порядке и сохраняя границы и ссылки источников. Детерминированное ' +
        'экстрактивное сжатие без обращения к LLM: формулировки и факты не ' +
        'переписываются. Второй шаг пайплайна; на вход подавай сырой вывод ' +
        'search, вывод — дословно в save_to_file. Если targetWords задан и ' +
        'источника не хватает, инструмент возвращает максимум возможного и ' +
        'помечает недостачу — тогда добавь результатов search и повтори ' +
        'summarize, не спрашивая пользователя.',
      inputSchema: {
        text: z
          .string()
          .describe('Сырой текст-источник (например, вывод search) для сжатия'),
        targetWords: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            'Желаемый объём в словах (цель из плана или запроса). Если не задан — ' +
              'объём выбирается по контексту',
          ),
        maxSentences: z
          .number()
          .int()
          .min(SUMMARIZE_MIN_SENTENCES)
          .max(SUMMARIZE_MAX_SENTENCES)
          .optional()
          .describe(
            `Верхняя граница числа предложений (${SUMMARIZE_MIN_SENTENCES}–${SUMMARIZE_MAX_SENTENCES}); если не задана, вход сохраняется целиком`,
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.summarize(args)),
  )

  server.registerTool(
    'save_to_file',
    {
      title: 'Сохранить отчёт в файл',
      description:
        'Сохраняет переданный текст в файл отчёта по имени name (безопасное имя, ' +
        'расширение .md добавляется автоматически) и возвращает путь. Пишет ' +
        'содержимое дословно — передавай вывод summarize (служебная строка ' +
        '«[Объём: …]» в файл не попадает). ' +
        'Изменяющий инструмент — финальный шаг пайплайна.',
      inputSchema: {
        name: z.string().describe('Имя отчёта без пути, например euro-usd-report'),
        content: z.string().describe('Текст отчёта для сохранения'),
      },
      annotations: { readOnlyHint: false },
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
      annotations: { readOnlyHint: true },
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
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.readReport(args)),
  )
}
