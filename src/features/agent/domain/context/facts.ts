import { splitHistory, toLlmMessages } from '../compression'
import { formatFactsBlock, mergeFacts } from '../facts'
import type { ContextStrategy, FactsCapability } from './types'
import { WINDOW_SIZE } from './window'

export function createFactsStrategy(
  capability: FactsCapability,
): ContextStrategy {
  return {
    id: 'facts',
    async prepare({ rows, request }) {
      let updated = capability.facts
      let auxUsage = null
      try {
        const extracted = await capability.extractFacts(
          capability.facts,
          request,
        )
        auxUsage = extracted.usage
        updated = mergeFacts(capability.facts, extracted.facts)
        await capability.saveFacts(updated)
      } catch {
        updated = capability.facts
      }
      const { recent } = splitHistory(rows, WINDOW_SIZE)
      const block = formatFactsBlock(updated)
      return {
        context: {
          history: toLlmMessages(recent),
          blocks: block.length > 0 ? [{ kind: 'facts', content: block }] : [],
          note: {
            kind: 'facts',
            label: 'Факты диалога',
            text: block.length > 0 ? block : 'Фактов пока нет.',
            messages: updated.length,
            throughMessageId: null,
          },
        },
        auxUsage,
      }
    },
  }
}
