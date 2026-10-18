import type { Dirent } from 'node:fs'
import type { SourceFile } from '../domain/sources'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  'coverage',
  '.vite',
  '.next',
  '.cache',
  'test-results',
  'playwright-report',
  'markup',
  'public',
  'assets',
  'fonts',
  'img',
])

const INCLUDE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.json',
]

const MAX_FILE_BYTES = 300_000
const MAX_TOTAL_BYTES = 5_000_000
const MAX_FILES = 2000

function hasExtension(path: string): boolean {
  const lower = path.toLowerCase()
  return INCLUDE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

function isWanted(path: string): boolean {
  if (path.endsWith('package-lock.json') || path.endsWith('package.json')) {
    return true
  }
  if (path.endsWith('tsconfig.json') || path.endsWith('vite.config.ts')) {
    return true
  }
  return hasExtension(path) && !path.endsWith('.json')
}

export async function collectSources(root: string): Promise<SourceFile[]> {
  const { readdir, readFile } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const files: SourceFile[] = []
  let total = 0

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES || total >= MAX_TOTAL_BYTES) {
      return
    }
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES || total >= MAX_TOTAL_BYTES) {
        return
      }
      const absolute = nodePath.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue
        }
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      const relative = nodePath
        .relative(root, absolute)
        .split(nodePath.sep)
        .join('/')
      if (!isWanted(relative)) {
        continue
      }
      try {
        const content = await readFile(absolute, 'utf8')
        if (content.length > MAX_FILE_BYTES) {
          continue
        }
        total += content.length
        files.push({ path: relative, content })
      } catch {
        continue
      }
    }
  }

  await walk(root)
  return files
}
