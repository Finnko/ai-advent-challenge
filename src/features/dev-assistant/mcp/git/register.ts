import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { toResponse } from '@lib/mcp/response.ts'
import type { GitToolkit } from './tools.ts'

export function registerGitTools(server: McpServer, toolkit: GitToolkit): void {
  server.registerTool(
    'git_branch',
    {
      title: 'Текущая git-ветка',
      description:
        'Возвращает имя текущей ветки репозитория проекта. Read-only.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => toResponse(await toolkit.branch({})),
  )

  server.registerTool(
    'git_status',
    {
      title: 'Статус рабочего дерева',
      description:
        'Показывает незакоммиченные изменения (git status --short --branch). Read-only.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => toResponse(await toolkit.status({})),
  )

  server.registerTool(
    'git_log',
    {
      title: 'История коммитов',
      description:
        'Последние коммиты: хэш, дата, автор и сообщение. Read-only.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Сколько коммитов вернуть (по умолчанию 10)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.log(args)),
  )

  server.registerTool(
    'git_changed_files',
    {
      title: 'Изменённые файлы',
      description:
        'Список изменённых файлов: незакоммиченные (по умолчанию) или ' +
        'относительно base. Read-only.',
      inputSchema: {
        base: z
          .string()
          .optional()
          .describe(
            'База сравнения: имя ветки или sha. Без неё — изменения рабочего дерева.',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.changedFiles(args)),
  )

  server.registerTool(
    'git_diff',
    {
      title: 'Дифф изменений',
      description:
        'Дифф: незакоммиченные изменения (по умолчанию) или относительно ' +
        'base. Результат обрезается по maxLines. Read-only.',
      inputSchema: {
        base: z
          .string()
          .optional()
          .describe('База сравнения: имя ветки или sha.'),
        path: z.string().optional().describe('Ограничить одним файлом.'),
        maxLines: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Максимум строк диффа (по умолчанию 200)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.diff(args)),
  )
}
