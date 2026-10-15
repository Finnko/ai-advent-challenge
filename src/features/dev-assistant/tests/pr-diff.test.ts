import { describe, expect, it } from 'vitest'
import { changedLinesByPath, parseUnifiedDiff } from '../domain/pr-diff'

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
