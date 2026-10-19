import { SUPPORT_ID_RE, SUPPORT_MAX_QUESTION_CHARS } from './constants'
import type { AskRequest } from './types'

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string }

function recordOf(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function idOf(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== 'string' || !SUPPORT_ID_RE.test(value.trim())) {
    return { ok: false, error: `Поле ${field} заполнено неверно.` }
  }
  return { ok: true, value: value.trim() }
}

export function parseAskRequest(
  value: unknown,
  maxQuestionChars = SUPPORT_MAX_QUESTION_CHARS,
): ParseResult<AskRequest> {
  const record = recordOf(value)
  if (!record) {
    return { ok: false, error: 'Ожидается JSON-объект.' }
  }
  const seller = idOf(record.sellerId, 'sellerId')
  if (!seller.ok) {
    return seller
  }
  const ticket = idOf(record.ticketId, 'ticketId')
  if (!ticket.ok) {
    return ticket
  }
  if (typeof record.question !== 'string') {
    return { ok: false, error: 'Поле question обязательно.' }
  }
  const question = record.question.trim()
  if (question.length === 0) {
    return { ok: false, error: 'Введите вопрос.' }
  }
  if (question.length > maxQuestionChars) {
    return {
      ok: false,
      error: `Вопрос длиннее ${maxQuestionChars} символов.`,
    }
  }
  return {
    ok: true,
    value: {
      sellerId: seller.value,
      ticketId: ticket.value,
      question,
    },
  }
}
