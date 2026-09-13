import type { LlmMessage } from './agent'
import { estimateMessagesTokens } from './tokens'

export const KEEP_RECENT_MESSAGES = 6
export const SUMMARY_CHUNK_MESSAGES = 10

export type CompressionMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
}

export type SummaryUsage = {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

export type SummarizeResult = {
  content: string
  usage: SummaryUsage | null
}

export type Summarize = (messages: LlmMessage[]) => Promise<SummarizeResult>

export type PreviousSummary = {
  text: string
  throughMessageId: number
}

export type PreparedHistory = {
  history: LlmMessage[]
  summary: string | null
  summaryTokens: number
  summarizedMessages: number
  throughMessageId: number
  refreshed: boolean
  summaryUsage: SummaryUsage | null
}

export function toLlmMessages(messages: CompressionMessage[]): LlmMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

export function summarySystemContent(summary: string): string {
  return `СВОДКА ПРЕДЫДУЩЕГО ДИАЛОГА:\n${summary}`
}

export function summaryTokensOf(summary: string | null): number {
  return summary
    ? estimateMessagesTokens([
        { role: 'system', content: summarySystemContent(summary) },
      ])
    : 0
}

export function splitHistory(
  history: CompressionMessage[],
  keepRecent = KEEP_RECENT_MESSAGES,
): { agedOut: CompressionMessage[]; recent: CompressionMessage[] } {
  if (history.length <= keepRecent) {
    return { agedOut: [], recent: [...history] }
  }
  let start = history.length - keepRecent
  while (start > 0 && history[start].role !== 'user') {
    start -= 1
  }
  return { agedOut: history.slice(0, start), recent: history.slice(start) }
}

export function pendingToSummarize(
  agedOut: CompressionMessage[],
  throughMessageId: number,
): CompressionMessage[] {
  return agedOut.filter((message) => message.id > throughMessageId)
}

export function shouldRefresh(
  count: number,
  chunkSize = SUMMARY_CHUNK_MESSAGES,
): boolean {
  return count >= chunkSize
}

export function buildSummaryMessages(
  previousSummary: string | null,
  messages: CompressionMessage[],
): LlmMessage[] {
  const transcript = messages
    .map(
      (message) =>
        `${message.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${message.content}`,
    )
    .join('\n\n')
  const system = [
    'Ты — суммаризатор истории корпоративного ассистента.',
    'Сожми диалог в краткую фактическую сводку. Сохрани: о чём просил пользователь, какие действия выполнены, брони и отпуска (комнаты, даты, время, темы, участники, коды подтверждения), имена людей и договорённости.',
    'Пиши по-русски, без markdown. Не добавляй вымышленные факты и не теряй коды подтверждения.',
  ].join('\n')
  const user = previousSummary
    ? [
        'Уже есть сводка предыдущей части диалога:',
        previousSummary,
        '',
        'Новая часть диалога, которую нужно к ней присоединить:',
        transcript,
      ].join('\n')
    : ['Сожми этот диалог:', transcript].join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

function countCovered(
  rows: CompressionMessage[],
  throughMessageId: number,
): number {
  if (throughMessageId <= 0) {
    return 0
  }
  return rows.filter((message) => message.id <= throughMessageId).length
}

export async function prepareHistoryWithSummary(args: {
  rows: CompressionMessage[]
  summarize: Summarize
  previousSummary?: PreviousSummary | null
  enabled?: boolean
  keepRecent?: number
  chunkSize?: number
}): Promise<PreparedHistory> {
  const {
    rows,
    summarize,
    previousSummary = null,
    enabled = true,
    keepRecent = KEEP_RECENT_MESSAGES,
    chunkSize = SUMMARY_CHUNK_MESSAGES,
  } = args

  if (!enabled) {
    return {
      history: toLlmMessages(rows),
      summary: null,
      summaryTokens: 0,
      summarizedMessages: 0,
      throughMessageId: previousSummary?.throughMessageId ?? 0,
      refreshed: false,
      summaryUsage: null,
    }
  }

  const previousThrough = previousSummary?.throughMessageId ?? 0
  const { agedOut, recent } = splitHistory(rows, keepRecent)
  const pending = pendingToSummarize(agedOut, previousThrough)

  let summary = previousSummary?.text ?? null
  let throughMessageId = previousThrough
  let summaryUsage: SummaryUsage | null = null
  let refreshed = false

  if (shouldRefresh(pending.length, chunkSize)) {
    try {
      const result = await summarize(
        buildSummaryMessages(previousSummary?.text ?? null, pending),
      )
      const next = result.content.trim()
      if (next.length > 0) {
        summary = next
        throughMessageId = pending[pending.length - 1].id
        summaryUsage = result.usage
        refreshed = true
      }
    } catch {
      refreshed = false
    }
  }

  return {
    history: toLlmMessages(recent),
    summary,
    summaryTokens: summaryTokensOf(summary),
    summarizedMessages: countCovered(rows, throughMessageId),
    throughMessageId,
    refreshed,
    summaryUsage,
  }
}
