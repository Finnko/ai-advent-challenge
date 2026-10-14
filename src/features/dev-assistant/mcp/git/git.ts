import { execFile } from 'node:child_process'
import type {
  GitChangedFile,
  GitCommit,
  GitDiff,
  GitSource,
  GitStatus,
} from '../../domain/git/types.ts'

export type GitRunner = (args: string[]) => Promise<string>

const MAX_BUFFER = 8 * 1024 * 1024
const LOG_FIELD_SEPARATOR = '\u001f'

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      },
    )
  })
}

export function createGitRunner(cwd: string): GitRunner {
  return (args) => runGit(cwd, args)
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
}

function parseLog(text: string): GitCommit[] {
  const commits: GitCommit[] = []
  for (const line of splitLines(text)) {
    const [hash, date, author, subject] = line.split(LOG_FIELD_SEPARATOR)
    if (!hash) {
      continue
    }
    commits.push({
      hash,
      date: date ?? '',
      author: author ?? '',
      subject: subject ?? '',
    })
  }
  return commits
}

function parseStatusChanges(text: string): GitChangedFile[] {
  const files: GitChangedFile[] = []
  for (const line of splitLines(text)) {
    const status = line.slice(0, 2).trim() || line.slice(0, 2)
    const rest = line.slice(3).trim()
    if (rest.length === 0) {
      continue
    }
    const path = rest.includes(' -> ')
      ? (rest.split(' -> ').pop() ?? rest)
      : rest
    files.push({ status, path })
  }
  return files
}

function parseNameStatus(text: string): GitChangedFile[] {
  const files: GitChangedFile[] = []
  for (const line of splitLines(text)) {
    const parts = line.split('\t')
    const status = parts[0]?.trim() ?? ''
    const path = (parts[parts.length - 1] ?? '').trim()
    if (status.length === 0 || path.length === 0) {
      continue
    }
    files.push({ status, path })
  }
  return files
}

export function createGitSource(options: { run: GitRunner }): GitSource {
  const { run } = options

  return {
    async branch() {
      const text = await run(['rev-parse', '--abbrev-ref', 'HEAD'])
      return text.trim() || 'HEAD'
    },
    async status(): Promise<GitStatus> {
      const text = await run(['status', '--short', '--branch'])
      const lines = splitLines(text)
      return {
        text: lines.join('\n'),
        clean: lines.filter((line) => !line.startsWith('##')).length === 0,
      }
    },
    async log(limit) {
      const text = await run([
        'log',
        `-n`,
        String(limit),
        `--pretty=format:%H${LOG_FIELD_SEPARATOR}%ad${LOG_FIELD_SEPARATOR}%an${LOG_FIELD_SEPARATOR}%s`,
        '--date=iso-strict',
      ])
      return parseLog(text)
    },
    async changedFiles(base) {
      if (base) {
        const text = await run(['diff', '--name-status', `${base}...HEAD`])
        return parseNameStatus(text)
      }
      const text = await run(['status', '--porcelain'])
      return parseStatusChanges(text)
    },
    async diff({ base, path, maxLines }): Promise<GitDiff> {
      const args = ['diff']
      args.push(base ? `${base}...HEAD` : 'HEAD')
      if (path) {
        args.push('--', path)
      }
      const text = await run(args)
      const lines = text.split('\n')
      const truncated = lines.length > maxLines
      const limited = truncated ? lines.slice(0, maxLines) : lines
      return {
        base: base ?? null,
        text: limited.join('\n').trim(),
        truncated,
        lines: lines.length,
      }
    },
  }
}
