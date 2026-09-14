import { toLlmMessages } from '../compression'
import type { ContextStrategy } from './types'

export const branchStrategy: ContextStrategy = {
  id: 'branch',
  label: 'Ветки диалога',
  description:
    'В запрос уходит активная ветка от checkpoint; переключение ветки меняет историю.',
  async prepare({ rows, branchLabel }) {
    return {
      context: {
        history: toLlmMessages(rows),
        blocks: [],
        note: branchLabel
          ? {
              kind: 'branch',
              label: 'Активная ветка',
              text: branchLabel,
              messages: rows.length,
              throughMessageId: null,
            }
          : null,
      },
      auxUsage: null,
    }
  },
}
