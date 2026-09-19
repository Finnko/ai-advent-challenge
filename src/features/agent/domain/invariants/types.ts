export type InvariantCategory =
  | 'architecture'
  | 'stack'
  | 'decision'
  | 'business'

export const invariantCheckIds = [
  'meeting-end-time',
  'vacation-duration',
  'orion-employee',
  'sqlite-only',
  'server-secrets',
] as const

export type InvariantCheckId = (typeof invariantCheckIds)[number]

export type InvariantRecord = {
  id: number
  token: string
  slug: string
  category: InvariantCategory
  title: string
  text: string
  check: InvariantCheckId | null
  pinned: boolean
}

export type InvariantCode = `INV-${number}`

export type InvariantInput = {
  slug: string
  category: InvariantCategory
  title: string
  text: string
  check?: InvariantCheckId | null
}

export type InvariantUpdateInput = Omit<InvariantInput, 'slug'>

export const CATEGORY_LABELS: Record<InvariantCategory, string> = {
  architecture: 'Архитектура',
  stack: 'Стек',
  decision: 'Решения',
  business: 'Бизнес-правила',
}

export const INVARIANT_CATEGORIES = Object.keys(CATEGORY_LABELS) as InvariantCategory[]

export const INVARIANT_BLOCK_TITLE = 'ИНВАРИАНТЫ И ОГРАНИЧЕНИЯ'
export const INVARIANT_PRECEDENCE_LINE =
  'Блок ИНВАРИАНТЫ И ОГРАНИЧЕНИЯ выше: не предлагай и не выполняй решения, которые нарушают эти правила. При отказе назови INV-<id> и предложи совместимую альтернативу.'

export function invariantCode(record: Pick<InvariantRecord, 'id'>): InvariantCode {
  return `INV-${record.id}`
}
