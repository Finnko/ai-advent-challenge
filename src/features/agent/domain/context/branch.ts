import { toLlmMessages } from '../compression'
import type { ContextStrategy } from './types'

export const branchStrategy: ContextStrategy = {
  id: 'branch',
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
