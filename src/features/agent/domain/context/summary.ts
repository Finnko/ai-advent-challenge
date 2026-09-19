import {
  prepareHistoryWithSummary,
  summarySystemContent,
  type PreparedHistory,
} from '../compression'
import type { ContextNote } from '../agent'
import type { ContextStrategy, SummaryCapability } from './types'

function buildSummaryNote(prepared: PreparedHistory): ContextNote | null {
  if (!prepared.summary) {
    return null
  }
  return {
    kind: 'summary',
    label: 'Сводка истории',
    text: prepared.summary,
    messages: prepared.summarizedMessages,
    throughMessageId:
      prepared.throughMessageId > 0 ? prepared.throughMessageId : null,
  }
}

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
          note: buildSummaryNote(prepared),
        },
        auxUsage: prepared.summaryUsage,
      }
    },
  }
}
