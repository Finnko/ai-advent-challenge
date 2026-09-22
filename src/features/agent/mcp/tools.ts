import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function registerDemoTools(server: McpServer): void {
  server.registerTool(
    'now',
    {
      title: 'Текущее время',
      description:
        'Возвращает текущие дату и время сервера в формате ISO 8601. ' +
        'Демонстрационный инструмент без входных параметров.',
    },
    async () => ({
      content: [{ type: 'text', text: new Date().toISOString() }],
    }),
  )

  server.registerTool(
    'echo',
    {
      title: 'Эхо',
      description:
        'Повторяет переданный текст. Демонстрационный инструмент ' +
        'с входным параметром.',
      inputSchema: {
        text: z.string().describe('Текст, который нужно вернуть'),
      },
    },
    async ({ text }) => ({
      content: [{ type: 'text', text }],
    }),
  )
}
