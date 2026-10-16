import { describe, expect, it } from 'vitest'
import { changedLinesByPath, parseUnifiedDiff } from '../domain/pr-diff'
import { clipToCaps } from '../server/pr-diff.server'

const RAW = [
  'diff --git a/src/lib/a.ts b/src/lib/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/lib/a.ts',
  '+++ b/src/lib/a.ts',
  '@@ -1,3 +1,4 @@',
  ' const a = 1',
  '+const b = 2',
  ' const c = 3',
  'diff --git a/src/lib/new.ts b/src/lib/new.ts',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/src/lib/new.ts',
  '@@ -0,0 +1,2 @@',
  '+export const x = 1',
  '+export const y = 2',
  'diff --git a/src/lib/gone.ts b/src/lib/gone.ts',
  'deleted file mode 100644',
  'index 4444444..0000000',
  '--- a/src/lib/gone.ts',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '-export const old = 1',
  '-export const older = 2',
].join('\n')

describe('unified diff parser', () => {
  it('splits files and maps added lines on the RIGHT side', () => {
    const files = parseUnifiedDiff(RAW)
    expect(files.map((file) => file.path)).toEqual([
      'src/lib/a.ts',
      'src/lib/new.ts',
      'src/lib/gone.ts',
    ])

    const modified = files[0]
    expect(modified.status).toBe('modified')
    expect(modified.addedLines).toEqual([2])
    expect(modified.patch).toContain('diff --git a/src/lib/a.ts b/src/lib/a.ts')

    const added = files[1]
    expect(added.status).toBe('added')
    expect(added.addedLines).toEqual([1, 2])

    const deleted = files[2]
    expect(deleted.status).toBe('deleted')
    expect(deleted.path).toBe('src/lib/gone.ts')
    expect(deleted.addedLines).toEqual([])
  })

  it('builds an anchor lookup per path', () => {
    const map = changedLinesByPath(parseUnifiedDiff(RAW))
    expect(map.get('src/lib/a.ts')?.has(2)).toBe(true)
    expect(map.get('src/lib/a.ts')?.has(1)).toBe(false)
    expect(map.get('src/lib/new.ts')?.has(2)).toBe(true)
  })
})

describe('diff size caps', () => {
  function file(path: string, lineCount: number) {
    return {
      path,
      status: 'modified' as const,
      patch: Array.from({ length: lineCount }, (_, index) => `+строка ${index}`).join('\n'),
      addedLines: [1],
      addedCount: 1,
    }
  }

  it('keeps files in order until the budget runs out', () => {
    const result = clipToCaps([file('a.ts', 5), file('b.ts', 5), file('c.ts', 5)], 40, 12)
    expect(result.files.map((entry) => entry.path)).toEqual(['a.ts', 'b.ts'])
    expect(result.omitted).toEqual(['c.ts'])
    expect(result.lines).toBe(10)
    expect(result.patchClipped).toBe(false)
  })

  it('trims an oversized first file instead of letting it eat the whole budget', () => {
    const result = clipToCaps([file('huge.ts', 500), file('small.ts', 2)], 40, 10)
    expect(result.files.map((entry) => entry.path)).toEqual(['huge.ts'])
    expect(result.files[0].patch.split('\n')).toHaveLength(11)
    expect(result.files[0].patch).toContain('патч обрезан по бюджету')
    expect(result.omitted).toEqual(['small.ts'])
    expect(result.patchClipped).toBe(true)
  })

  it('stops at the file cap', () => {
    const result = clipToCaps([file('a.ts', 1), file('b.ts', 1), file('c.ts', 1)], 2, 1500)
    expect(result.files.map((entry) => entry.path)).toEqual(['a.ts', 'b.ts'])
    expect(result.omitted).toEqual(['c.ts'])
  })
})
