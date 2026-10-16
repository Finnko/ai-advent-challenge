export type PullRequestFileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

export type PullRequestDiffFile = {
  path: string
  status: PullRequestFileStatus
  patch: string
  /** Line numbers in the NEW version of the file (RIGHT side of the diff). */
  addedLines: number[]
  addedCount: number
}

export type PullRequestDiff = {
  base: string
  head: string
  files: PullRequestDiffFile[]
  /** Paths dropped by the size caps; listed in the review body. */
  omitted: string[]
  text: string
  truncated: boolean
  changedLines: number
}

const HUNK_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

function headerPath(header: string, plus: string, minus: string): string {
  if (plus !== '/dev/null') {
    return plus.replace(/^b\//, '')
  }
  if (minus !== '/dev/null') {
    return minus.replace(/^a\//, '')
  }
  const match = header.match(/ a\/.+ b\/(.+)$/)
  return match?.[1] ?? ''
}

// Pure unified-diff parser: split the raw `git diff` output into files and, per
// file, the set of line numbers a GitHub inline comment may anchor to (the
// added/changed lines of the new file). Nothing here touches git or the network,
// so it is the unit-test surface of the diff reader.
export function parseUnifiedDiff(raw: string): PullRequestDiffFile[] {
  const blocks = raw.split(/^diff --git /m).slice(1)
  const files: PullRequestDiffFile[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const header = lines[0] ?? ''
    const firstHunk = lines.findIndex((line) => line.startsWith('@@'))
    const headerLines = firstHunk === -1 ? lines : lines.slice(0, firstHunk)
    const hunkLines = firstHunk === -1 ? [] : lines.slice(firstHunk)

    const plusLine = headerLines.find((line) => line.startsWith('+++ '))
    const minusLine = headerLines.find((line) => line.startsWith('--- '))
    const path = headerPath(
      header,
      plusLine?.slice(4) ?? '/dev/null',
      minusLine?.slice(4) ?? '/dev/null',
    )

    const hasNew = headerLines.some((line) => line.startsWith('new file mode'))
    const hasDeleted = headerLines.some((line) =>
      line.startsWith('deleted file mode'),
    )
    const hasRename = headerLines.some((line) => line.startsWith('rename '))
    let status: PullRequestFileStatus = 'modified'
    if (hasNew) {
      status = 'added'
    } else if (hasDeleted) {
      status = 'deleted'
    } else if (hasRename) {
      status = 'renamed'
    }

    const addedLines: number[] = []
    let newLineNo = 0
    for (const line of hunkLines) {
      const hunk = HUNK_RE.exec(line)
      if (hunk) {
        newLineNo = Number(hunk[1])
        continue
      }
      if (newLineNo === 0) {
        continue
      }
      if (line.startsWith('+')) {
        addedLines.push(newLineNo)
        newLineNo += 1
        continue
      }
      if (line.startsWith('-')) {
        continue
      }
      if (line.startsWith('\\')) {
        continue
      }
      newLineNo += 1
    }

    if (path.length === 0) {
      continue
    }
    files.push({
      path,
      status,
      patch: `diff --git ${block}`.trimEnd(),
      addedLines,
      addedCount: addedLines.length,
    })
  }
  return files
}

export function changedLinesByPath(
  files: { path: string; addedLines: number[] }[],
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const file of files) {
    map.set(file.path, new Set(file.addedLines))
  }
  return map
}
