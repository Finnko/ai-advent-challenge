import type { ChatUsage } from '@lib/llm'
import type { AnswerQuote, ScoredChunk } from '@lib/rag-engine.types'

export type SellerStatus = 'active' | 'blocked' | 'limited'
export type SellerScheme = 'FBS' | 'FBO' | 'RFBS'

export type ApiKeyInfo = {
  label: string
  last4: string
  expiresAt: string
}

export type Seller = {
  id: string
  name: string
  legalForm: 'ИП' | 'ООО'
  status: SellerStatus
  statusReason: string | null
  tariff: string
  scheme: SellerScheme
  registeredAt: string
  apiKeys: ApiKeyInfo[]
  restrictions: string[]
}

export type TicketMessage = {
  author: 'seller' | 'support'
  at: string
  text: string
}

export type Ticket = {
  id: string
  sellerId: string
  subject: string
  status: 'open' | 'answered' | 'closed'
  createdAt: string
  updatedAt: string
  orderId: string | null
  productId: string | null
  messages: TicketMessage[]
}

export type PostingProduct = {
  sku: string
  name: string
  quantity: number
  price: number
}

export type Posting = {
  postingNumber: string
  sellerId: string
  status: string
  createdAt: string
  shipBy: string
  warehouse: string
  products: PostingProduct[]
}

export type Product = {
  id: string
  sellerId: string
  name: string
  status: 'moderated' | 'rejected' | 'pending'
  moderationErrors: string[]
  price: number
  stock: number
}

export type Finance = {
  sellerId: string
  currency: string
  nextPayoutAt: string
  nextPayoutAmount: number
  accrued: number
  onHold: number
  lastPayoutAt: string
  lastPayoutAmount: number
  note: string
}

export type SellerSummary = Pick<
  Seller,
  'id' | 'name' | 'status' | 'tariff' | 'scheme'
>

export type TicketSummary = Pick<
  Ticket,
  'id' | 'sellerId' | 'subject' | 'status' | 'createdAt'
>

export type Catalog = {
  sellers: SellerSummary[]
  tickets: TicketSummary[]
}

export type ToolTrace = {
  name: string
  args: Record<string, string>
  ok: boolean
  durationMs: number
  error: string | null
}

export type AskRequest = {
  sellerId: string
  ticketId: string
  question: string
}

export type AskResult = {
  question: string
  answer: string
  format: 'json' | 'text'
  abstained: boolean
  generator: 'cloud' | 'local'
  model: string | null
  usage: ChatUsage | null
  latencyMs: number
  reranked: boolean
  sources: ScoredChunk[]
  quotes: AnswerQuote[]
  contextUsed: boolean
  contextBlocks: string[]
  contextError: string | null
  seller: SellerSummary | null
  ticket: TicketSummary | null
  trace: ToolTrace[]
}
