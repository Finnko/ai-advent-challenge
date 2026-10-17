import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { toResponse } from '@lib/mcp/response.ts'
import type { OzonToolkit } from './tools'

export function registerOzonTools(
  server: McpServer,
  toolkit: OzonToolkit,
): void {
  server.registerTool(
    'get_seller',
    {
      title: 'Карточка продавца',
      description:
        'Возвращает аккаунт продавца: статус, тариф, схему работы, дату регистрации, ' +
        'ограничения и замаскированные API-ключи. Read-only.',
      inputSchema: { sellerId: z.string().describe('ID продавца') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.seller(args)),
  )

  server.registerTool(
    'list_tickets',
    {
      title: 'Тикеты продавца',
      description:
        'Перечисляет тикеты продавца: ID, тему, статус и дату. Read-only.',
      inputSchema: { sellerId: z.string().describe('ID продавца') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.listTickets(args)),
  )

  server.registerTool(
    'get_ticket',
    {
      title: 'Тикет с перепиской',
      description:
        'Возвращает тикет: тему, статус, связанные отправление и товар, последние сообщения. Read-only.',
      inputSchema: { ticketId: z.string().describe('ID тикета') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.ticket(args)),
  )

  server.registerTool(
    'list_postings',
    {
      title: 'Отправления продавца',
      description:
        'Перечисляет отправления продавца в формах Ozon Seller API, опционально по статусу. Read-only.',
      inputSchema: {
        sellerId: z.string().describe('ID продавца'),
        status: z
          .string()
          .optional()
          .describe('Фильтр по статусу, например awaiting_packaging'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.listPostings(args)),
  )

  server.registerTool(
    'get_posting',
    {
      title: 'Отправление',
      description:
        'Возвращает отправление: статус, срок сборки, склад и состав. Read-only.',
      inputSchema: { postingNumber: z.string().describe('Номер отправления') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.posting(args)),
  )

  server.registerTool(
    'get_product',
    {
      title: 'Товар и модерация',
      description:
        'Возвращает товар: статус модерации, ошибки, цену и остаток. Read-only.',
      inputSchema: { productId: z.string().describe('ID товара') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.product(args)),
  )

  server.registerTool(
    'get_finance',
    {
      title: 'Расчёты продавца',
      description:
        'Возвращает ближайшую выплату, начисления, удержания и прошлую выплату. Read-only.',
      inputSchema: { sellerId: z.string().describe('ID продавца') },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.finance(args)),
  )
}
