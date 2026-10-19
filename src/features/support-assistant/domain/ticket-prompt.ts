import type {
  Finance,
  Posting,
  Product,
  Seller,
  Ticket,
  TicketMessage,
} from './types'

const STATUS_LABELS: Record<string, string> = {
  active: 'активен',
  blocked: 'заблокирован',
  limited: 'ограничен',
  open: 'открыт',
  answered: 'отвечен',
  closed: 'закрыт',
  awaiting_packaging: 'ожидает упаковки',
  awaiting_deliver: 'ожидает отгрузки',
  delivered: 'доставлен',
  moderated: 'прошёл модерацию',
  rejected: 'отклонён',
  pending: 'на проверке',
}

const AUTHOR_LABELS: Record<TicketMessage['author'], string> = {
  seller: 'Продавец',
  support: 'Поддержка',
}

export function formatDate(value: string): string {
  if (value.length === 0) {
    return '—'
  }
  return value.slice(0, 10)
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatStatus(value: string): string {
  return STATUS_LABELS[value] ?? value
}

export function formatSeller(seller: Seller): string {
  const lines = [
    `ID: ${seller.id}`,
    `Название: ${seller.name}`,
    `Статус: ${formatStatus(seller.status)}${
      seller.statusReason ? ` — ${seller.statusReason}` : ''
    }`,
    `Тариф: ${seller.tariff}`,
    `Схема: ${seller.scheme}`,
    `Регистрация: ${formatDate(seller.registeredAt)}`,
  ]
  if (seller.restrictions.length > 0) {
    lines.push(`Ограничения: ${seller.restrictions.join('; ')}`)
  }
  if (seller.apiKeys.length > 0) {
    const keys = seller.apiKeys.map(
      (key) =>
        `${key.label} — •••• ${key.last4}, действует до ${formatDate(key.expiresAt)}`,
    )
    lines.push(`API-ключи: ${keys.join('; ')}`)
  }
  return lines.join('\n')
}

export function formatTicket(ticket: Ticket): string {
  const lines = [
    `ID: ${ticket.id}`,
    `Тема: ${ticket.subject}`,
    `Статус: ${formatStatus(ticket.status)}`,
    `Создан: ${formatDate(ticket.createdAt)}, обновлён: ${formatDate(ticket.updatedAt)}`,
  ]
  if (ticket.orderId) {
    lines.push(`Связанное отправление: ${ticket.orderId}`)
  }
  if (ticket.productId) {
    lines.push(`Связанный товар: ${ticket.productId}`)
  }
  const messages = ticket.messages.slice(-3)
  for (const message of messages) {
    lines.push(
      `${AUTHOR_LABELS[message.author]} (${formatDate(message.at)}): ${message.text}`,
    )
  }
  return lines.join('\n')
}

export function formatPosting(posting: Posting): string {
  const products = posting.products
    .map((item) => `${item.name} × ${item.quantity} (${item.price} ₽)`)
    .join('; ')
  return [
    `Отправление: ${posting.postingNumber}`,
    `Статус: ${formatStatus(posting.status)}`,
    `Срок сборки: ${formatDate(posting.shipBy)}`,
    `Склад: ${posting.warehouse}`,
    `Состав: ${products}`,
  ].join('\n')
}

export function formatProduct(product: Product): string {
  const lines = [
    `Товар: ${product.name} (${product.id})`,
    `Статус модерации: ${formatStatus(product.status)}`,
    `Цена: ${product.price} ₽, остаток: ${product.stock} шт.`,
  ]
  if (product.moderationErrors.length > 0) {
    lines.push(`Ошибки: ${product.moderationErrors.join('; ')}`)
  }
  return lines.join('\n')
}

export function formatFinance(finance: Finance): string {
  return [
    `Продавец: ${finance.sellerId}`,
    `Ближайшая выплата: ${formatDate(finance.nextPayoutAt)} — ${formatMoney(finance.nextPayoutAmount, finance.currency)}`,
    `Начислено: ${formatMoney(finance.accrued, finance.currency)}`,
    `На удержании: ${formatMoney(finance.onHold, finance.currency)}`,
    `Прошлая выплата: ${formatDate(finance.lastPayoutAt)} — ${formatMoney(finance.lastPayoutAmount, finance.currency)}`,
    finance.note,
  ].join('\n')
}
