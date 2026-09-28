import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { toResponse } from '../shared/response.ts'
import type { MarketToolkit } from './tools.ts'

export function registerMarketTools(
  server: McpServer,
  toolkit: MarketToolkit,
): void {
  server.registerTool(
    'exchange_rate',
    {
      title: 'Курс валют',
      description:
        'Возвращает курс обмена одной валюты к другой (по умолчанию EUR→USD) по ' +
        'данным ЕЦБ без ключа. Можно указать дату в прошлом (YYYY-MM-DD). ' +
        'Справочный инструмент; подходит для финансовой сводки.',
      inputSchema: {
        base: z
          .string()
          .optional()
          .describe('Валюта-источник, код из трёх букв (по умолчанию EUR)'),
        quote: z
          .string()
          .optional()
          .describe('Валюта-назначение, код из трёх букв (по умолчанию USD)'),
        date: z
          .string()
          .optional()
          .describe('Дата в формате YYYY-MM-DD (необязательно)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.exchangeRate(args)),
  )
}
