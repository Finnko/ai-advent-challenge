import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { PullRequestDiff, PullRequestDiffFile } from '../domain/pr-diff'
import { parseUnifiedDiff } from '../domain/pr-diff'

const execFileAsync = promisify(execFile)
const MAX_BUFFER = 64 * 1024 * 1024

export const DEFAULT_MAX_DIFF_FILES = 40
export const DEFAULT_MAX_DIFF_LINES = 1500

// Generated/lock files carry no review signal but can eat the whole budget.
const SKIP_RE = [
  /(?:^|\/)package-lock\.json$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /(?:^|\/)yarn\.lock$/,
  /(?:^|\/)\.cache\//,
  /(?:^|\/)dist\//,
]

export type PullRequestDiffOptions = {
  root: string
  base: string
  head: string
  maxFiles?: number
  maxLines?: number
}

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  })
  return String(stdout)
}

function clipToCaps(
  files: PullRequestDiffFile[],
  maxFiles: number,
  maxLines: number,
): { files: PullRequestDiffFile[]; omitted: string[]; lines: number } {
  const included: PullRequestDiffFile[] = []
  const omitted: string[] = []
  let lines = 0
  for (const file of files) {
    const fileLines = file.patch.split('\n').length
    const first = included.length === 0
    if (
      !first &&
      (included.length >= maxFiles || lines + fileLines > maxLines)
    ) {
      omitted.push(file.path)
      continue
    }
    included.push(file)
    lines += fileLines
  }
  return { files: included, omitted, lines }
}

// Reads the pull-request diff from the checkout with a three-dot range
// (`git merge-base` semantics), so a moved base branch does not inflate it.
// The three-dot form matches what GitHub shows on the PR's "Files changed".
export async function readPullRequestDiff(
  options: PullRequestDiffOptions,
): Promise<PullRequestDiff> {
  const raw = await runGit(options.root, [
    'diff',
    '--unified=3',
    '--no-color',
    '--no-ext-diff',
    `${options.base}...${options.head}`,
  ])
  const parsed = parseUnifiedDiff(raw).filter(
    (file) => !SKIP_RE.some((re) => re.test(file.path)),
  )
  const clipped = clipToCaps(
    parsed,
    options.maxFiles ?? DEFAULT_MAX_DIFF_FILES,
    options.maxLines ?? DEFAULT_MAX_DIFF_LINES,
  )
  const truncated = clipped.omitted.length > 0
  const parts = clipped.files.map((file) => file.patch)
  if (truncated) {
    const shown = clipped.omitted.slice(0, 20).join(', ')
    parts.push(
      `\n(дифф усечён по размеру: пропущено файлов — ${clipped.omitted.length}: ${shown}${
        clipped.omitted.length > 20 ? ', …' : ''
      })`,
    )
  }
  return {
    base: options.base,
    head: options.head,
    files: clipped.files,
    omitted: clipped.omitted,
    text: parts.join('\n').trim(),
    truncated,
    changedLines: clipped.files.reduce(
      (total, file) => total + file.addedCount,
      0,
    ),
  }
}
