import { toLlmMessages } from '../compression'
import type { ContextStrategy } from './types'

export const noneStrategy: ContextStrategy = {
  id: 'none',
  async prepare({ rows }) {
    return {
      context: {
        history: toLlmMessages(rows),
        blocks: [],
        note: null,
      },
      auxUsage: null,
    }
  },
}
