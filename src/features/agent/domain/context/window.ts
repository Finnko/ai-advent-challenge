import type { ContextStrategy } from './types'
import { splitHistory, toLlmMessages } from '../compression'

export const WINDOW_SIZE = 10

export const windowStrategy: ContextStrategy = {
  id: 'window',
  async prepare({ rows, windowSize }) {
    const size = windowSize ?? WINDOW_SIZE
    const { agedOut, recent } = splitHistory(rows, size)
    return {
      context: {
        history: toLlmMessages(recent),
        blocks: [],
        note:
          agedOut.length > 0
            ? {
                kind: 'window',
                label: 'Скользящее окно',
                text: `Отброшено ${agedOut.length} сообщ.; в запрос уходят последние ${size}.`,
                messages: agedOut.length,
                throughMessageId: null,
              }
            : null,
      },
      auxUsage: null,
    }
  },
}
