import { splitHistory, toLlmMessages } from '../compression'
import { formatFactsBlock, mergeFacts } from '../facts'
import type { ContextStrategy } from './types'
import { WINDOW_SIZE } from './window'

export const factsStrategy: ContextStrategy = {
  id: 'facts',
  label: 'Факты (key-value)',
  description:
    'Важные факты обновляются после каждого хода; в запрос уходят факты и последние сообщения.',
  async prepare({ rows, request, facts, extractFacts, saveFacts }) {
    let updated = facts
    let auxUsage = null
    try {
      const extracted = await extractFacts(facts, request)
      auxUsage = extracted.usage
      updated = mergeFacts(facts, extracted.facts)
      await saveFacts(updated)
    } catch {
      updated = facts
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
