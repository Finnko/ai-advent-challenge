import { join } from 'node:path'
import type {
  Catalog,
  Finance,
  Posting,
  Product,
  Seller,
  Ticket,
} from '../../domain/types'
import { createSandbox } from './sandbox'

const SELLERS = 'sellers.json'
const TICKETS = 'tickets.json'
const POSTINGS = 'postings.json'
const PRODUCTS = 'products.json'
const FINANCE = 'finance.json'

export function resolveFixturesRoot(): string {
  return (
    process.env.SUPPORT_FIXTURES_DIR?.trim() ||
    join(
      process.cwd(),
      'src',
      'features',
      'support-assistant',
      'data',
      'fixtures',
    )
  )
}

export type OzonSource = {
  catalog: () => Promise<Catalog>
  seller: (id: string) => Promise<Seller | null>
  ticketsBySeller: (sellerId: string) => Promise<Ticket[]>
  ticket: (id: string) => Promise<Ticket | null>
  postingsBySeller: (sellerId: string) => Promise<Posting[]>
  posting: (postingNumber: string) => Promise<Posting | null>
  product: (id: string) => Promise<Product | null>
  finance: (sellerId: string) => Promise<Finance | null>
}

export function createOzonSource(root: string): OzonSource {
  const sandbox = createSandbox(root)

  async function sellers(): Promise<Seller[]> {
    return sandbox.readJson<Seller[]>(SELLERS)
  }

  async function tickets(): Promise<Ticket[]> {
    return sandbox.readJson<Ticket[]>(TICKETS)
  }

  async function postings(): Promise<Posting[]> {
    return sandbox.readJson<Posting[]>(POSTINGS)
  }

  async function products(): Promise<Product[]> {
    return sandbox.readJson<Product[]>(PRODUCTS)
  }

  return {
    async catalog() {
      const [sellerRows, ticketRows] = await Promise.all([sellers(), tickets()])
      return {
        sellers: sellerRows.map((seller) => ({
          id: seller.id,
          name: seller.name,
          status: seller.status,
          tariff: seller.tariff,
          scheme: seller.scheme,
        })),
        tickets: ticketRows.map((ticket) => ({
          id: ticket.id,
          sellerId: ticket.sellerId,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt,
        })),
      }
    },
    async seller(id) {
      const rows = await sellers()
      return rows.find((seller) => seller.id === id) ?? null
    },
    async ticketsBySeller(sellerId) {
      const rows = await tickets()
      return rows.filter((ticket) => ticket.sellerId === sellerId)
    },
    async ticket(id) {
      const rows = await tickets()
      return rows.find((ticket) => ticket.id === id) ?? null
    },
    async postingsBySeller(sellerId) {
      const rows = await postings()
      return rows.filter((posting) => posting.sellerId === sellerId)
    },
    async posting(postingNumber) {
      const rows = await postings()
      return (
        rows.find((posting) => posting.postingNumber === postingNumber) ?? null
      )
    },
    async product(id) {
      const rows = await products()
      return rows.find((product) => product.id === id) ?? null
    },
    async finance(sellerId) {
      const rows = await sandbox.readJson<Finance[]>(FINANCE)
      return rows.find((entry) => entry.sellerId === sellerId) ?? null
    },
  }
}
