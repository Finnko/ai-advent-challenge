import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import {
  REPORT_DEFAULT_NAME,
  REPORT_EXTENSION,
  REPORT_MAX_NAME_LENGTH,
  type ReportEntry,
  type ReportsStore,
} from '../../domain/research/types.ts'

export function resolveReportsDir(): string {
  const configured = process.env.REPORTS_DIR?.trim()
  if (configured) {
    return configured
  }
  return join(homedir(), '.ai-advent-challenge', 'reports')
}

export function sanitizeReportName(raw: unknown): string {
  const input = typeof raw === 'string' ? raw : ''
  let name = input
    .replace(/[\\/]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
    .slice(0, REPORT_MAX_NAME_LENGTH)
  if (name.length === 0) {
    name = REPORT_DEFAULT_NAME
  }
  if (!name.toLowerCase().endsWith(REPORT_EXTENSION)) {
    name = `${name}${REPORT_EXTENSION}`
  }
  return name
}

function resolveReportPath(dir: string, name: string): string {
  const base = resolve(dir)
  const target = resolve(base, name)
  if (!target.startsWith(base + sep)) {
    throw new Error(`Недопустимое имя отчёта: ${name}`)
  }
  return target
}

export function createFileReportsStore(
  dir: string = resolveReportsDir(),
): ReportsStore {
  return {
    async save(name, content) {
      const safeName = sanitizeReportName(name)
      await mkdir(dir, { recursive: true })
      const target = resolveReportPath(dir, safeName)
      await writeFile(target, content, { encoding: 'utf8' })
      return { path: target }
    },

    async list() {
      let names: string[]
      try {
        names = await readdir(dir)
      } catch {
        return []
      }
      const entries: ReportEntry[] = []
      for (const name of names) {
        if (!name.toLowerCase().endsWith(REPORT_EXTENSION)) {
          continue
        }
        try {
          const info = await stat(join(dir, name))
          if (info.isFile()) {
            entries.push({
              name,
              size: info.size,
              modifiedAt: info.mtime.toISOString(),
            })
          }
        } catch {
          continue
        }
      }
      return entries.sort((left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt),
      )
    },

    async read(name) {
      const safeName = sanitizeReportName(name)
      try {
        return await readFile(resolveReportPath(dir, safeName), 'utf8')
      } catch {
        return null
      }
    },
  }
}
