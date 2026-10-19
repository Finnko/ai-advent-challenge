import type { McpCallResult } from '@lib/mcp/types'
import type { McpSession } from '@lib/mcp/client.server'
import { SupportError } from '../domain/errors'
import type {
  Finance,
  Posting,
  Product,
  Seller,
  Ticket,
  ToolTrace,
} from '../domain/types'

export type SupportContext = {
  seller: Seller | null
  ticket: Ticket | null
  finance: Finance | null
  postings: Posting[]
  product: Product | null
  trace: ToolTrace[]
  contextError: string | null
}

type CallArgs = Record<string, string>

function structuredOf<T>(result: McpCallResult): T | null {
  if (!result.ok || !result.structured) {
    return null
  }
  return result.structured as T
}

async function callTool(
  session: McpSession,
  trace: ToolTrace[],
  name: string,
  args: CallArgs,
): Promise<McpCallResult> {
  const startedAt = Date.now()
  const result = await session.call(name, args)
  trace.push({
    name,
    args,
    ok: result.ok,
    durationMs: Date.now() - startedAt,
    error: result.ok ? null : result.error,
  })
  return result
}

function requiredSeller(result: McpCallResult, sellerId: string): Seller {
  const seller = structuredOf<{ seller: Seller }>(result)?.seller
  if (!result.ok) {
    throw new SupportError(
      'unknown_seller',
      `Продавец ${sellerId} не найден.`,
      404,
    )
  }
  if (!seller) {
    throw new SupportError(
      'mcp_failed',
      'MCP-сервер не вернул карточку продавца.',
      502,
    )
  }
  return seller
}

function requiredTicket(result: McpCallResult, ticketId: string): Ticket {
  const ticket = structuredOf<{ ticket: Ticket }>(result)?.ticket
  if (!result.ok) {
    throw new SupportError(
      'unknown_ticket',
      `Тикет ${ticketId} не найден.`,
      404,
    )
  }
  if (!ticket) {
    throw new SupportError('mcp_failed', 'MCP-сервер не вернул тикет.', 502)
  }
  return ticket
}

export async function collectSupportContext(
  session: McpSession,
  input: { sellerId: string; ticketId: string },
): Promise<SupportContext> {
  const trace: ToolTrace[] = []
  const sellerResult = await callTool(session, trace, 'get_seller', {
    sellerId: input.sellerId,
  })
  const seller = requiredSeller(sellerResult, input.sellerId)

  const ticketResult = await callTool(session, trace, 'get_ticket', {
    ticketId: input.ticketId,
  })
  const ticket = requiredTicket(ticketResult, input.ticketId)

  if (ticket.sellerId !== seller.id) {
    throw new SupportError(
      'seller_mismatch',
      'Тикет принадлежит другому продавцу.',
      400,
    )
  }

  const financeResult = await callTool(session, trace, 'get_finance', {
    sellerId: input.sellerId,
  })
  const finance =
    structuredOf<{ finance: Finance }>(financeResult)?.finance ?? null

  const postingsResult = await callTool(session, trace, 'list_postings', {
    sellerId: input.sellerId,
  })
  const listed = structuredOf<{ postings: Posting[] }>(postingsResult)
  const postings: Posting[] = []

  if (ticket.orderId) {
    const postingResult = await callTool(session, trace, 'get_posting', {
      postingNumber: ticket.orderId,
    })
    const linked = structuredOf<{ posting: Posting }>(postingResult)
    if (linked?.posting) {
      postings.push(linked.posting)
    }
  }

  for (const posting of listed?.postings ?? []) {
    if (
      !postings.some((item) => item.postingNumber === posting.postingNumber)
    ) {
      postings.push(posting)
    }
  }

  let product: Product | null = null
  if (ticket.productId) {
    const productResult = await callTool(session, trace, 'get_product', {
      productId: ticket.productId,
    })
    product = structuredOf<{ product: Product }>(productResult)?.product ?? null
  }

  return {
    seller,
    ticket,
    finance,
    postings,
    product,
    trace,
    contextError: null,
  }
}
