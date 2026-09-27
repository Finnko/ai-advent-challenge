import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { errorMessage, type ToolResponse } from './shared/response.ts'
import { bookingsByRoom, dbOverview, employeeSchedule } from './db.ts'

async function textResult(load: () => Promise<string>): Promise<ToolResponse> {
  try {
    return { content: [{ type: 'text', text: await load() }] }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `Ошибка чтения базы: ${errorMessage(error)}` },
      ],
      isError: true,
    }
  }
}

export function registerDemoTools(server: McpServer): void {
  server.registerTool(
    'now',
    {
      title: 'Текущее время',
      description:
        'Возвращает текущие дату и время сервера в формате ISO 8601. ' +
        'Демонстрационный инструмент без входных параметров.',
      annotations: { readOnlyHint: true },
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
      annotations: { readOnlyHint: true },
    },
    async ({ text }) => ({
      content: [{ type: 'text', text }],
    }),
  )

  server.registerTool(
    'db_overview',
    {
      title: 'Обзор базы агента',
      description:
        'Возвращает счётчики записей по таблицам базы агента: сотрудники, ' +
        'сессии, сообщения, брони, отпуска, инварианты, профили. Без входных параметров.',
      annotations: { readOnlyHint: true },
    },
    async () => textResult(() => dbOverview()),
  )

  server.registerTool(
    'bookings_by_room',
    {
      title: 'Брони по переговоркам',
      description:
        'Показывает количество броней по каждой переговорке по всей компании ' +
        '(не только пользователя). Можно ограничить период датами from/to в формате YYYY-MM-DD.',
      inputSchema: {
        from: z
          .string()
          .optional()
          .describe('Начало периода, YYYY-MM-DD (необязательно)'),
        to: z
          .string()
          .optional()
          .describe('Конец периода, YYYY-MM-DD (необязательно)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ from, to }) => textResult(() => bookingsByRoom(from, to)),
  )

  server.registerTool(
    'employee_schedule',
    {
      title: 'Встречи сотрудника',
      description:
        'Показывает встречи указанного сотрудника из базы агента, даже если ' +
        'пользователь не является его руководителем. Даты from/to в формате YYYY-MM-DD необязательны.',
      inputSchema: {
        employeeName: z.string().describe('Имя сотрудника'),
        from: z
          .string()
          .optional()
          .describe('Начало периода, YYYY-MM-DD (необязательно)'),
        to: z
          .string()
          .optional()
          .describe('Конец периода, YYYY-MM-DD (необязательно)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ employeeName, from, to }) =>
      textResult(() => employeeSchedule(employeeName, from, to)),
  )
}
