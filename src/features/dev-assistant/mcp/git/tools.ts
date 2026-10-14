import { errorMessage, fail, ok, type ToolResult } from '@lib/mcp/response.ts'
import type { StructuredContent } from '@lib/mcp/types.ts'
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

function commitPayload(commit: GitCommit): StructuredContent {
  return {
    hash: commit.hash,
    date: commit.date,
    author: commit.author,
    subject: commit.subject,
  }
}

function filePayload(file: GitChangedFile): StructuredContent {
  return { status: file.status, path: file.path }
}

export function createGitToolkit(deps: { git: GitSource }): GitToolkit {
  return {
    async branch() {
      try {
        const branch = await deps.git.branch()
        return ok(`Текущая ветка: ${branch}`, { branch })
      } catch (error) {
        return fail(`Не удалось получить ветку: ${errorMessage(error)}`)
      }
    },
    async status() {
      try {
        const status = await deps.git.status()
        if (status.clean) {
          return ok('Рабочее дерево чистое, незакоммиченных изменений нет.', {
            clean: true,
          })
        }
        return ok(`git status:\n${status.text}`, { clean: false })
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
        const payload = { commits: commits.map(commitPayload) }
        if (commits.length === 0) {
          return ok('История коммитов пуста.', payload)
        }
        return ok(
          `Последние коммиты:\n${commits.map(formatCommit).join('\n')}`,
          payload,
        )
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
        const payload = { base: base ?? null, files: files.map(filePayload) }
        if (files.length === 0) {
          return ok(
            base
              ? `Нет изменений относительно ${base}.`
              : 'Нет изменённых файлов.',
            payload,
          )
        }
        const suffix = base ? ` относительно ${base}` : ''
        return ok(
          `Изменённые файлы${suffix}:\n${files.map(formatFile).join('\n')}`,
          payload,
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
        const payload = {
          base: base ?? null,
          path: path ?? null,
          truncated: diff.truncated,
          lines: diff.lines,
          text: diff.text,
        }
        if (diff.text.length === 0) {
          return ok('Дифф пуст — изменений нет.', payload)
        }
        const suffix = diff.truncated
          ? `\n…(обрезано до ${maxLines} строк из ${diff.lines})`
          : ''
        return ok(
          `git diff${base ? ` ${base}...HEAD` : ''}:\n${diff.text}${suffix}`,
          payload,
        )
      } catch (error) {
        return fail(`Не удалось получить дифф: ${errorMessage(error)}`)
      }
    },
  }
}
