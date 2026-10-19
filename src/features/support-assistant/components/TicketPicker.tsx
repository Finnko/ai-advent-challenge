import { Badge } from '@/components/ui/Badge'
import type { Catalog, SellerStatus, Ticket } from '../domain/types'

const SELLER_VARIANTS: Record<SellerStatus, 'success' | 'danger' | 'warn'> = {
  active: 'success',
  blocked: 'danger',
  limited: 'warn',
}

const SELLER_LABELS: Record<SellerStatus, string> = {
  active: 'активен',
  blocked: 'заблокирован',
  limited: 'ограничен',
}

const TICKET_VARIANTS: Record<Ticket['status'], 'accent' | 'warn' | 'outline'> =
  {
    open: 'accent',
    answered: 'warn',
    closed: 'outline',
  }

const TICKET_LABELS: Record<Ticket['status'], string> = {
  open: 'открыт',
  answered: 'отвечен',
  closed: 'закрыт',
}

export default function TicketPicker({
  catalog,
  sellerId,
  ticketId,
  onSeller,
  onTicket,
  disabled,
}: {
  catalog: Catalog | null
  sellerId: string
  ticketId: string
  onSeller: (id: string) => void
  onTicket: (id: string) => void
  disabled: boolean
}) {
  if (!catalog) {
    return (
      <div className="demo-muted text-sm">Загружаю продавцов и тикеты…</div>
    )
  }

  const seller = catalog.sellers.find((item) => item.id === sellerId)
  const tickets = catalog.tickets.filter((item) => item.sellerId === sellerId)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
        Продавец
        <select
          className="h-10 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
          value={sellerId}
          onChange={(event) => onSeller(event.target.value)}
          disabled={disabled}
        >
          {catalog.sellers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.scheme}
            </option>
          ))}
        </select>
        {seller && (
          <span className="flex items-center gap-2 font-normal">
            <Badge variant={SELLER_VARIANTS[seller.status]}>
              {SELLER_LABELS[seller.status]}
            </Badge>
            <span className="demo-muted">{seller.tariff}</span>
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--ink-soft)]">
        Тикет
        <select
          className="h-10 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
          value={ticketId}
          onChange={(event) => onTicket(event.target.value)}
          disabled={disabled || tickets.length === 0}
        >
          {tickets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.subject}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-2 font-normal">
          {tickets
            .filter((item) => item.id === ticketId)
            .map((item) => (
              <Badge key={item.id} variant={TICKET_VARIANTS[item.status]}>
                {TICKET_LABELS[item.status]}
              </Badge>
            ))}
          <span className="demo-muted font-mono">{ticketId}</span>
        </span>
      </label>
    </div>
  )
}
