import { errorMessage, fail, ok, type ToolResult } from '@lib/mcp/response.ts'
import type {
  GitChangedFile,
  GitCommit,
  GitSource,
} from '../../domain/git/types.ts'

type Args = Record<string, unknown>

export const DEFAULT_LOG_LIMIT = 10
export const MAX_LOG_LIMIT = 50
export const DEFAULT_DIFF_MAX_LINES = 200
export const MAX_DIFF_MAX_LINES = 1000

export type GitToolkit = {
  branch: (args: Args) => Promise<ToolResult>
  status: (args: Args) => Promise<ToolResult>
  log: (args: Args) => Promise<ToolResult>
  changedFiles: (args: Args) => Promise<ToolResult>
  diff: (args: Args) => Promise<ToolResult>
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

function formatCommit(commit: GitCommit): string {
  const short = commit.hash.slice(0, 8)
  const date = commit.date ? commit.date.slice(0, 10) : '——'
  return `${short} ${date} ${commit.author}: ${commit.subject}`
}

function formatFile(file: GitChangedFile): string {
  return `${file.status}\t${file.path}`
}

export function createGitToolkit(deps: { git: GitSource }): GitToolkit {
  return {
    async branch() {
      try {
        const branch = await deps.git.branch()
        return ok(`Текущая ветка: ${branch}`)
      } catch (error) {
        return fail(`Не удалось получить ветку: ${errorMessage(error)}`)
      }
    },
    async status() {
      try {
        const status = await deps.git.status()
        if (status.clean) {
          return ok('Рабочее дерево чистое, незакоммиченных изменений нет.')
        }
        return ok(`git status:\n${status.text}`)
      } catch (error) {
        return fail(`Не удалось получить статус: ${errorMessage(error)}`)
      }
    },
    async log(args) {
      const limit = positiveInt(args.limit, DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT)
      if (limit === null) {
        return fail(`limit должен быть целым от 1 до ${MAX_LOG_LIMIT}.`)
      }
      try {
        const commits = await deps.git.log(limit)
        if (commits.length === 0) {
          return ok('История коммитов пуста.')
        }
        return ok(`Последние коммиты:\n${commits.map(formatCommit).join('\n')}`)
      } catch (error) {
        return fail(`Не удалось получить историю: ${errorMessage(error)}`)
      }
    },
    async changedFiles(args) {
      const base = optionalString(args.base)
      if (base === null) {
        return fail('base должен быть строкой — имя ветки или sha.')
      }
      try {
        const files = await deps.git.changedFiles(base)
        if (files.length === 0) {
          return ok(
            base
              ? `Нет изменений относительно ${base}.`
              : 'Нет изменённых файлов.',
          )
        }
        const suffix = base ? ` относительно ${base}` : ''
        return ok(
          `Изменённые файлы${suffix}:\n${files.map(formatFile).join('\n')}`,
        )
      } catch (error) {
        return fail(
          `Не удалось получить список изменений: ${errorMessage(error)}`,
        )
      }
    },
    async diff(args) {
      const base = optionalString(args.base)
      const path = optionalString(args.path)
      if (base === null) {
        return fail('base должен быть строкой — имя ветки или sha.')
      }
      if (path === null) {
        return fail('path должен быть строкой — путь к файлу.')
      }
      const maxLines = positiveInt(
        args.maxLines,
        DEFAULT_DIFF_MAX_LINES,
        MAX_DIFF_MAX_LINES,
      )
      if (maxLines === null) {
        return fail(`maxLines должен быть целым от 1 до ${MAX_DIFF_MAX_LINES}.`)
      }
      try {
        const diff = await deps.git.diff({ base, path, maxLines })
        if (diff.text.length === 0) {
          return ok('Дифф пуст — изменений нет.')
        }
        const suffix = diff.truncated
          ? `\n…(обрезано до ${maxLines} строк из ${diff.lines})`
          : ''
        return ok(
          `git diff${base ? ` ${base}...HEAD` : ''}:\n${diff.text}${suffix}`,
        )
      } catch (error) {
        return fail(`Не удалось получить дифф: ${errorMessage(error)}`)
      }
    },
  }
}
