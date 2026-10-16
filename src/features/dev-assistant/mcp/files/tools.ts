import { errorMessage, fail, ok, type ToolResult } from '@lib/mcp/response.ts'
import type { Sandbox } from './sandbox.ts'
import type { FilesSource } from './source.ts'

type Args = Record<string, unknown>

export const DEFAULT_LIST_LIMIT = 200
export const MAX_LIST_LIMIT = 2000
export const DEFAULT_READ_LINES = 200
export const MAX_READ_LINES = 2000
export const DEFAULT_SEARCH_RESULTS = 100
export const MAX_SEARCH_RESULTS = 500

export type FilesToolkit = {
  listFiles: (args: Args) => Promise<ToolResult>
  readFile: (args: Args) => Promise<ToolResult>
  searchText: (args: Args) => Promise<ToolResult>
  writeFile: (args: Args) => Promise<ToolResult>
  editFile: (args: Args) => Promise<ToolResult>
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function positiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number | null {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return null
  }
  return Math.min(value, max)
}

function globToRegExp(pattern: string): RegExp {
  let out = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        out += '.*'
        index += 1
      } else {
        out += '[^/]*'
      }
    } else if (char === '?') {
      out += '[^/]'
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`${out}$`)
}

function matchesGlob(relative: string, glob: string): boolean {
  const regex = globToRegExp(glob)
  if (glob.includes('/')) {
    return regex.test(relative)
  }
  const base = relative.split('/').at(-1) ?? relative
  return regex.test(base)
}

export function createFilesToolkit(deps: {
  sandbox: Sandbox
  source: FilesSource
}): FilesToolkit {
  const { sandbox, source } = deps

  return {
    async listFiles(args) {
      const requested = optionalString(args.path)
      if (requested === null) {
        return fail('path должен быть строкой — путь к каталогу.')
      }
      const target = sandbox.resolvePath(requested ?? '.')
      if (!target.ok) {
        return fail(target.error)
      }
      const glob = optionalString(args.glob)
      if (glob === null) {
        return fail('glob должен быть строкой.')
      }
      const limit = positiveInt(args.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
      if (limit === null) {
        return fail(`limit должен быть целым от 1 до ${MAX_LIST_LIMIT}.`)
      }
      try {
        if (!(await source.isDir(target.absolute))) {
          return fail(`Каталог не найден: ${target.relative}`)
        }
        const all = await source.list(
          target.absolute,
          target.relative,
          MAX_LIST_LIMIT,
        )
        const filtered = glob
          ? all.filter((entry) => matchesGlob(entry.path, glob))
          : all
        const entries = filtered.slice(0, limit)
        const payload = {
          path: target.relative,
          glob: glob ?? null,
          entries: entries.map((entry) => ({
            path: entry.path,
            type: entry.type,
          })),
          truncated: filtered.length > entries.length,
        }
        if (entries.length === 0) {
          return ok(`В ${target.relative} подходящих файлов нет.`, payload)
        }
        const text = entries
          .map((entry) => (entry.type === 'dir' ? `${entry.path}` : entry.path))
          .join('\n')
        const suffix =
          filtered.length > entries.length
            ? `\n…(показано ${entries.length} из ${filtered.length})`
            : ''
        return ok(
          `Содержимое ${target.relative} (${entries.length}):\n${text}${suffix}`,
          payload,
        )
      } catch (error) {
        return fail(`Не удалось прочитать каталог: ${errorMessage(error)}`)
      }
    },

    async readFile(args) {
      const path = optionalString(args.path)
      if (!path) {
        return fail('path обязателен.')
      }
      const target = sandbox.resolvePath(path)
      if (!target.ok) {
        return fail(target.error)
      }
      const maxLines = positiveInt(
        args.maxLines,
        DEFAULT_READ_LINES,
        MAX_READ_LINES,
      )
      if (maxLines === null) {
        return fail(`maxLines должен быть целым от 1 до ${MAX_READ_LINES}.`)
      }
      const startLine = positiveInt(args.startLine, 1, Number.MAX_SAFE_INTEGER)
      if (startLine === null) {
        return fail('startLine должен быть целым положительным числом.')
      }
      try {
        if (!(await source.isFile(target.absolute))) {
          return fail(`Файл не найден: ${target.relative}`)
        }
        const content = await source.read(target.absolute)
        const lines = content.split('\n')
        const from = Math.min(startLine, lines.length)
        const slice = lines.slice(from - 1, from - 1 + maxLines)
        const to = from - 1 + slice.length
        const payload = {
          path: target.relative,
          totalLines: lines.length,
          from,
          to,
          truncated: to < lines.length,
        }
        const numbered = slice
          .map((line, index) => `${from + index}: ${line}`)
          .join('\n')
        const suffix =
          to < lines.length
            ? `\n…(показаны строки ${from}–${to} из ${lines.length}; продолжение — startLine=${to + 1})`
            : ''
        return ok(
          `Файл ${target.relative} (строки ${from}–${to} из ${lines.length}):\n${numbered}${suffix}`,
          payload,
        )
      } catch (error) {
        return fail(`Не удалось прочитать файл: ${errorMessage(error)}`)
      }
    },

    async searchText(args) {
      const query = optionalString(args.query)
      if (!query) {
        return fail('query обязателен.')
      }
      const requested = optionalString(args.path)
      if (requested === null) {
        return fail('path должен быть строкой — где искать.')
      }
      const target = sandbox.resolvePath(requested ?? '.')
      if (!target.ok) {
        return fail(target.error)
      }
      const glob = optionalString(args.glob)
      if (glob === null) {
        return fail('glob должен быть строкой.')
      }
      const maxResults = positiveInt(
        args.maxResults,
        DEFAULT_SEARCH_RESULTS,
        MAX_SEARCH_RESULTS,
      )
      if (maxResults === null) {
        return fail(
          `maxResults должен быть целым от 1 до ${MAX_SEARCH_RESULTS}.`,
        )
      }
      try {
        const hits = await source.search({
          query,
          relative: target.relative,
          glob,
          maxResults,
        })
        const payload = {
          query,
          path: target.relative,
          matches: hits.map((hit) => ({
            path: hit.path,
            line: hit.line,
            text: hit.text,
          })),
          truncated: hits.length >= maxResults,
        }
        if (hits.length === 0) {
          return ok(`Совпадений для «${query}» не найдено.`, payload)
        }
        const text = hits
          .map((hit) => `${hit.path}:${hit.line}: ${hit.text.trim()}`)
          .join('\n')
        const suffix =
          hits.length >= maxResults ? '\n…(показаны не все совпадения)' : ''
        return ok(
          `Совпадения «${query}» (${hits.length}):\n${text}${suffix}`,
          payload,
        )
      } catch (error) {
        return fail(`Поиск не удался: ${errorMessage(error)}`)
      }
    },

    async writeFile(args) {
      const path = optionalString(args.path)
      if (!path) {
        return fail('path обязателен.')
      }
      const content = args.content
      if (typeof content !== 'string') {
        return fail('content обязателен и должен быть строкой.')
      }
      const target = sandbox.resolvePath(path)
      if (!target.ok) {
        return fail(target.error)
      }
      try {
        const existed = await source.isFile(target.absolute)
        await source.write(target.absolute, content)
        const bytes = Buffer.byteLength(content, 'utf8')
        const lines = content.length === 0 ? 0 : content.split('\n').length
        const payload = {
          path: target.relative,
          bytes,
          lines,
          created: !existed,
        }
        return ok(
          `Файл записан: ${target.relative} (${bytes} байт, ${lines} строк, ${existed ? 'перезапись' : 'создан'}).`,
          payload,
        )
      } catch (error) {
        return fail(`Не удалось записать файл: ${errorMessage(error)}`)
      }
    },

    async editFile(args) {
      const path = optionalString(args.path)
      if (!path) {
        return fail('path обязателен.')
      }
      const oldString = args.oldString
      if (typeof oldString !== 'string' || oldString.length === 0) {
        return fail('oldString обязателен и не должен быть пустым.')
      }
      const newString = typeof args.newString === 'string' ? args.newString : ''
      const replaceAll = args.replaceAll === true
      const target = sandbox.resolvePath(path)
      if (!target.ok) {
        return fail(target.error)
      }
      try {
        if (!(await source.isFile(target.absolute))) {
          return fail(`Файл не найден: ${target.relative}`)
        }
        const content = await source.read(target.absolute)
        const occurrences = content.split(oldString).length - 1
        if (occurrences === 0) {
          return fail(`oldString не найден в ${target.relative}.`)
        }
        if (occurrences > 1 && !replaceAll) {
          return fail(
            `oldString встречается ${occurrences} раз — совпадение не уникально. Добавь контекст или replaceAll: true.`,
          )
        }
        const next = replaceAll
          ? content.split(oldString).join(newString)
          : content.replace(oldString, newString)
        await source.write(target.absolute, next)
        const payload = {
          path: target.relative,
          replacements: replaceAll ? occurrences : 1,
        }
        return ok(
          `Файл изменён: ${target.relative} (замен ${payload.replacements}).`,
          payload,
        )
      } catch (error) {
        return fail(`Не удалось изменить файл: ${errorMessage(error)}`)
      }
    },
  }
}
