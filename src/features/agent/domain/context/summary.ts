import {
  prepareHistoryWithSummary,
  summarySystemContent,
} from '../compression'
import type { ContextStrategy, SummaryCapability } from './types'

export function createSummaryStrategy(
  capability: SummaryCapability,
): ContextStrategy {
  return {
    id: 'summary',
    async prepare({ rows }) {
      const prepared = await prepareHistoryWithSummary({
        rows,
        previousSummary: capability.previousSummary,
        summarize: capability.summarize,
        enabled: true,
      })

      if (prepared.refreshed && prepared.summary) {
        await capability.saveSummary(
          prepared.summary,
          prepared.throughMessageId,
        )
      }

      return {
        context: {
          history: prepared.history,
          blocks: prepared.summary
            ? [
                {
                  kind: 'summary',
                  content: summarySystemContent(prepared.summary),
                },
              ]
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
}
