import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { toResponse } from '@lib/mcp/response.ts'
import type { FilesToolkit } from './tools.ts'

export function registerFilesTools(
  server: McpServer,
  toolkit: FilesToolkit,
): void {
  server.registerTool(
    'list_files',
    {
      title: 'Обход файлов проекта',
      description:
        'Список файлов и каталогов под указанным путём (по умолчанию — корень проекта). ' +
        'Запрещены .git, node_modules, dist, .env*, *.sqlite. Read-only.',
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe('Каталог относительно корня проекта (по умолчанию «.»).'),
        glob: z
          .string()
          .optional()
          .describe('Фильтр по шаблону, например «*.ts» или «src/**/*.ts».'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe('Сколько записей вернуть (по умолчанию 200).'),
      },
      outputSchema: {
        path: z.string(),
        glob: z.string().nullable(),
        entries: z.array(
          z.object({ path: z.string(), type: z.enum(['file', 'dir']) }),
        ),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.listFiles(args)),
  )

  server.registerTool(
    'read_file',
    {
      title: 'Чтение файла',
      description:
        'Читает содержимое файла с нумерацией строк и капом по строкам. Read-only.',
      inputSchema: {
        path: z.string().describe('Путь к файлу относительно корня проекта.'),
        startLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Первая строка (по умолчанию 1).'),
        maxLines: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe('Максимум строк (по умолчанию 200).'),
      },
      outputSchema: {
        path: z.string(),
        totalLines: z.number(),
        from: z.number(),
        to: z.number(),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.readFile(args)),
  )

  server.registerTool(
    'search_text',
    {
      title: 'Поиск по тексту',
      description:
        'Ищет подстроку или регулярное выражение в файлах через rg (уважает .gitignore) ' +
        'и возвращает совпадения «файл:строка». Read-only.',
      inputSchema: {
        query: z.string().describe('Что искать (шаблон rg).'),
        path: z
          .string()
          .optional()
          .describe('Где искать, относительно корня (по умолчанию «.»).'),
        glob: z.string().optional().describe('Фильтр путей, например «*.ts».'),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe('Максимум совпадений (по умолчанию 100).'),
      },
      outputSchema: {
        query: z.string(),
        path: z.string(),
        matches: z.array(
          z.object({ path: z.string(), line: z.number(), text: z.string() }),
        ),
        truncated: z.boolean(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => toResponse(await toolkit.searchText(args)),
  )

  server.registerTool(
    'write_file',
    {
      title: 'Запись файла',
      description:
        'Создаёт или перезаписывает файл целиком. Изменяющий инструмент.',
      inputSchema: {
        path: z.string().describe('Путь к файлу относительно корня проекта.'),
        content: z.string().describe('Полное содержимое файла.'),
      },
      outputSchema: {
        path: z.string(),
        bytes: z.number(),
        lines: z.number(),
        created: z.boolean(),
      },
    },
    async (args) => toResponse(await toolkit.writeFile(args)),
  )

  server.registerTool(
    'edit_file',
    {
      title: 'Правка файла',
      description:
        'Заменяет oldString на newString. Требует уникального совпадения, ' +
        'если не указан replaceAll. Изменяющий инструмент.',
      inputSchema: {
        path: z.string().describe('Путь к файлу относительно корня проекта.'),
        oldString: z.string().describe('Что заменить (уникальный фрагмент).'),
        newString: z.string().describe('На что заменить.'),
        replaceAll: z
          .boolean()
          .optional()
          .describe('Заменить все совпадения (по умолчанию false).'),
      },
      outputSchema: {
        path: z.string(),
        replacements: z.number(),
      },
    },
    async (args) => toResponse(await toolkit.editFile(args)),
  )
}
