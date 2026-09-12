import {
  prepareHistoryWithSummary,
  summarySystemContent,
} from '../compression'
import type { ContextStrategy } from './types'

export const summaryStrategy: ContextStrategy = {
  id: 'summary',
  label: 'Сжатие истории',
  description:
    'Старые ходы сворачиваются в сводку; в запрос уходят последние сообщения и сводка.',
  async prepare({ rows, previousSummary, summarize, saveSummary }) {
    const prepared = await prepareHistoryWithSummary({
      rows,
      previousSummary,
      summarize,
      enabled: true,
    })

    if (prepared.refreshed && prepared.summary) {
      await saveSummary(prepared.summary, prepared.throughMessageId)
    }

    return {
      context: {
        history: prepared.history,
        blocks: prepared.summary
          ? [{ kind: 'summary', content: summarySystemContent(prepared.summary) }]
          : [],
        note: prepared.summary
          ? {
              kind: 'summary',
              label: 'Сводка истории',
              text: prepared.summary,
              messages: prepared.summarizedMessages,
              throughMessageId:
                prepared.throughMessageId > 0
                  ? prepared.throughMessageId
                  : null,
            }
          : null,
      },
      auxUsage: prepared.summaryUsage,
    }
  },
}
