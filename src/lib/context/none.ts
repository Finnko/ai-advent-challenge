import { toLlmMessages } from '../compression'
import type { ContextStrategy } from './types'

export const noneStrategy: ContextStrategy = {
  id: 'none',
  label: 'Без сжатия',
  description: 'Вся история ветки уходит в запрос как есть.',
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
