import { errorMessage, fail, ok, type ToolResult } from '@lib/mcp/response.ts'
import {
  formatFinance,
  formatPosting,
  formatProduct,
  formatSeller,
} from '../../domain/ticket-prompt'
import type { OzonSource } from './source'

export const MAX_POSTINGS = 10

export type OzonToolkit = {
  seller: (args: { sellerId: string }) => Promise<ToolResult>
  listTickets: (args: { sellerId: string }) => Promise<ToolResult>
  ticket: (args: { ticketId: string }) => Promise<ToolResult>
  listPostings: (args: {
    sellerId: string
    status?: string
  }) => Promise<ToolResult>
  posting: (args: { postingNumber: string }) => Promise<ToolResult>
  product: (args: { productId: string }) => Promise<ToolResult>
  finance: (args: { sellerId: string }) => Promise<ToolResult>
}

function ticketLine(ticket: {
  id: string
  subject: string
  status: string
  createdAt: string
}): string {
  return `${ticket.id} · ${ticket.subject} · ${ticket.status} · ${ticket.createdAt.slice(0, 10)}`
}

export function createOzonToolkit(source: OzonSource): OzonToolkit {
  return {
    async seller({ sellerId }) {
      try {
        const seller = await source.seller(sellerId)
        if (!seller) {
          return fail(`Продавец ${sellerId} не найден.`)
        }
        return ok(formatSeller(seller), { seller })
      } catch (error) {
        return fail(`Не удалось прочитать продавца: ${errorMessage(error)}`)
      }
    },
    async listTickets({ sellerId }) {
      try {
        const tickets = await source.ticketsBySeller(sellerId)
        if (tickets.length === 0) {
          return ok(`У продавца ${sellerId} нет тикетов.`, { tickets: [] })
        }
        return ok(tickets.map(ticketLine).join('\n'), { tickets })
      } catch (error) {
        return fail(`Не удалось прочитать тикеты: ${errorMessage(error)}`)
      }
    },
    async ticket({ ticketId }) {
      try {
        const ticket = await source.ticket(ticketId)
        if (!ticket) {
          return fail(`Тикет ${ticketId} не найден.`)
        }
        return ok(
          [
            `Тикет ${ticket.id}: ${ticket.subject}`,
            `Статус: ${ticket.status}`,
            ...ticket.messages.map(
              (message) => `${message.author}: ${message.text}`,
            ),
          ].join('\n'),
          { ticket },
        )
      } catch (error) {
        return fail(`Не удалось прочитать тикет: ${errorMessage(error)}`)
      }
    },
    async listPostings({ sellerId, status }) {
      try {
        const rows = await source.postingsBySeller(sellerId)
        const filtered = status
          ? rows.filter((posting) => posting.status === status)
          : rows
        const postings = filtered.slice(0, MAX_POSTINGS)
        if (postings.length === 0) {
          return ok(`У продавца ${sellerId} нет подходящих отправлений.`, {
            postings: [],
          })
        }
        return ok(postings.map(formatPosting).join('\n\n'), { postings })
      } catch (error) {
        return fail(`Не удалось прочитать отправления: ${errorMessage(error)}`)
      }
    },
    async posting({ postingNumber }) {
      try {
        const posting = await source.posting(postingNumber)
        if (!posting) {
          return fail(`Отправление ${postingNumber} не найдено.`)
        }
        return ok(formatPosting(posting), { posting })
      } catch (error) {
        return fail(`Не удалось прочитать отправление: ${errorMessage(error)}`)
      }
    },
    async product({ productId }) {
      try {
        const product = await source.product(productId)
        if (!product) {
          return fail(`Товар ${productId} не найден.`)
        }
        return ok(formatProduct(product), { product })
      } catch (error) {
        return fail(`Не удалось прочитать товар: ${errorMessage(error)}`)
      }
    },
    async finance({ sellerId }) {
      try {
        const finance = await source.finance(sellerId)
        if (!finance) {
          return fail(`Финансы продавца ${sellerId} не найдены.`)
        }
        return ok(formatFinance(finance), { finance })
      } catch (error) {
        return fail(`Не удалось прочитать финансы: ${errorMessage(error)}`)
      }
    },
  }
}
