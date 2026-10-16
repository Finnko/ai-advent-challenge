import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isProtectedPath } from '../../domain/protected-paths.ts'
import type { Sandbox } from './sandbox.ts'

export type FileEntry = { path: string; type: 'file' | 'dir' }
export type SearchHit = { path: string; line: number; text: string }
export type RgRunner = (args: string[], cwd: string) => Promise<string>

export type SearchInput = {
  query: string
  relative: string
  glob?: string
  maxResults: number
}

export type FilesSource = {
  list(absolute: string, relative: string, limit: number): Promise<FileEntry[]>
  read(absolute: string): Promise<string>
  write(absolute: string, content: string): Promise<void>
  isFile(absolute: string): Promise<boolean>
  isDir(absolute: string): Promise<boolean>
  search(input: SearchInput): Promise<SearchHit[]>
}

const MAX_BUFFER = 8 * 1024 * 1024

function runRg(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'rg',
      args,
      { cwd, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout) => {
        if (error && (error as { code?: number }).code !== 1) {
          reject(error)
          return
        }
        resolve(stdout)
      },
    )
  })
}

type RgEvent = {
  type?: string
  data?: {
    path?: { text?: string }
    line_number?: number
    lines?: { text?: string }
  }
}

function parseRgJson(text: string, limit: number): SearchHit[] {
  const hits: SearchHit[] = []
  for (const line of text.split('\n')) {
    if (line.trim().length === 0 || hits.length >= limit) {
      continue
    }
    let event: RgEvent
    try {
      event = JSON.parse(line) as RgEvent
    } catch {
      continue
    }
    if (event.type !== 'match' || !event.data) {
      continue
    }
    const path = event.data.path?.text
    if (!path) {
      continue
    }
    hits.push({
      path,
      line: event.data.line_number ?? 0,
      text: (event.data.lines?.text ?? '').replace(/\n$/, ''),
    })
  }
  return hits
}

export function createFilesSource(options: {
  sandbox: Sandbox
  rg?: RgRunner
}): FilesSource {
  const { sandbox } = options
  const rg = options.rg ?? runRg

  return {
    async list(absolute, relative, limit) {
      const entries: FileEntry[] = []
      const walk = async (dir: string, dirRelative: string): Promise<void> => {
        if (entries.length >= limit) {
          return
        }
        const dirents = await readdir(dir, { withFileTypes: true })
        for (const dirent of dirents) {
          if (entries.length >= limit) {
            return
          }
          const childRelative =
            dirRelative === '.' ? dirent.name : `${dirRelative}/${dirent.name}`
          if (isProtectedPath(childRelative)) {
            continue
          }
          if (dirent.isDirectory()) {
            entries.push({ path: `${childRelative}/`, type: 'dir' })
            await walk(join(dir, dirent.name), childRelative)
          } else if (dirent.isFile()) {
            entries.push({ path: childRelative, type: 'file' })
          }
        }
      }
      await walk(absolute, relative)
      return entries
    },
    read(absolute) {
      return readFile(absolute, 'utf8')
    },
    async write(absolute, content) {
      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, content, 'utf8')
    },
    async isFile(absolute) {
      try {
        return (await stat(absolute)).isFile()
      } catch {
        return false
      }
    },
    async isDir(absolute) {
      try {
        return (await stat(absolute)).isDirectory()
      } catch {
        return false
      }
    },
    async search({ query, relative, glob, maxResults }) {
      const args = ['--json', '--line-number', '--color', 'never']
      if (glob) {
        args.push('--glob', glob)
      }
      args.push('-e', query, relative)
      const text = await rg(args, sandbox.root)
      return parseRgJson(text, maxResults)
    },
  }
}
