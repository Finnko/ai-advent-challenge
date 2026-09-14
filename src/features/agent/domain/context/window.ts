import type { ContextStrategy } from './types'
import { splitHistory, toLlmMessages } from '../compression'

export const WINDOW_SIZE = 10

export const windowStrategy: ContextStrategy = {
  id: 'window',
  label: 'Скользящее окно',
  description:
    'В запрос уходят только последние сообщения, старое отбрасывается без следа.',
  async prepare({ rows }) {
    const { agedOut, recent } = splitHistory(rows, WINDOW_SIZE)
    return {
      context: {
        history: toLlmMessages(recent),
        blocks: [],
        note:
          agedOut.length > 0
            ? {
                kind: 'window',
                label: 'Скользящее окно',
                text: `Отброшено ${agedOut.length} сообщ.; в запрос уходят последние ${WINDOW_SIZE}.`,
                messages: agedOut.length,
                throughMessageId: null,
              }
            : null,
      },
      auxUsage: null,
    }
  },
}
