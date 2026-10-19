import { createFileRoute } from '@tanstack/react-router'
import SupportPage from '@/features/support-assistant/pages/SupportPage'

export const Route = createFileRoute('/support')({
  head: () => ({
    meta: [
      { title: 'Неофициальный помощник Ozon' },
      {
        name: 'description',
        content:
          'Учебный помощник продавцов Ozon: RAG по документации и контекст аккаунта через MCP.',
      },
    ],
  }),
  component: SupportPage,
})
