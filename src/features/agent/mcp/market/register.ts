import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MarketToolResult, MarketToolkit } from './tools.ts'

type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

function toResponse(result: MarketToolResult): ToolResponse {
  if (result.ok) {
    return { content: [{ type: 'text', text: result.text }] }
  }
  return {
    content: [{ type: 'text', text: result.text }],
    isError: true,
  }
}

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
    },
    async (args) => toResponse(await toolkit.exchangeRate(args)),
  )
}
