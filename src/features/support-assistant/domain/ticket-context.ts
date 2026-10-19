import { SUPPORT_CONTEXT_MAX_CHARS } from './constants'
import {
  formatFinance,
  formatPosting,
  formatProduct,
  formatSeller,
  formatTicket,
} from './ticket-prompt'
import type { Finance, Posting, Product, Seller, Ticket } from './types'

export type TicketContextInput = {
  seller: Seller | null
  ticket: Ticket | null
  finance: Finance | null
  postings: Posting[]
  product: Product | null
  maxChars?: number
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function collectBlocks(input: TicketContextInput): string[] {
  const blocks: string[] = []
  if (input.seller) {
    blocks.push(`Аккаунт продавца:\n${formatSeller(input.seller)}`)
  }
  if (input.finance) {
    blocks.push(`Финансы:\n${formatFinance(input.finance)}`)
  }
  if (input.ticket) {
    blocks.push(`Тикет:\n${formatTicket(input.ticket)}`)
  }
  if (input.postings.length > 0) {
    const postings = input.postings.map(formatPosting).join('\n\n')
    blocks.push(`Отправления:\n${postings}`)
  }
  if (input.product) {
    blocks.push(`Товар на модерации:\n${formatProduct(input.product)}`)
  }
  return blocks
}

export function buildTicketContext(input: TicketContextInput): string[] {
  const limit = input.maxChars ?? SUPPORT_CONTEXT_MAX_CHARS
  const blocks: string[] = []
  let remaining = limit
  for (const block of collectBlocks(input)) {
    if (remaining <= 0) {
      break
    }
    const next = truncate(block, remaining)
    blocks.push(next)
    remaining -= next.length + 2
  }
  return blocks
}
