import { describe, expect, it } from 'vitest'
import { createMcpHost } from '@lib/mcp/client.server'
import { createGitSource, type GitRunner } from '../mcp/git/git'
import { devAssistantMcpRegistry } from '../server/mcp-registry.server'

const host = createMcpHost(devAssistantMcpRegistry)

function fakeGit(
  handler: (
    args: string[],
    options?: { allowExitCodes?: number[] },
  ) => string | null,
): {
  run: GitRunner
  calls: Array<{ args: string[]; allowExitCodes?: number[] }>
} {
  const calls: Array<{ args: string[]; allowExitCodes?: number[] }> = []
  const run: GitRunner = async (args, options) => {
    calls.push({ args, allowExitCodes: options?.allowExitCodes })
    const result = handler(args, options)
    if (result === null) {
      throw new Error(`unexpected git call: ${args.join(' ')}`)
    }
    return result
  }
  return { run, calls }
}

describe('createGitSource — diff неотслеживаемого файла', () => {
  it('строит diff нового файла через --no-index', async () => {
    const newDiff = [
      'diff --git a/docs/new.md b/docs/new.md',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/docs/new.md',
      '@@ -0,0 +1 @@',
      '+Проверка подсветки diff',
    ].join('\n')
    const { run, calls } = fakeGit((args) => {
      if (args[0] === 'diff' && args[1] === 'HEAD') {
        return ''
      }
      if (args[0] === 'status') {
        return '?? docs/new.md\n'
      }
      if (args[0] === 'diff' && args[1] === '--no-index') {
        return newDiff
      }
      return null
    })

    const diff = await createGitSource({ run }).diff({
      base: null,
      path: 'docs/new.md',
      maxLines: 100,
    })

    expect(diff.text).toContain('+Проверка подсветки diff')
    expect(
      calls.find((call) => call.args[1] === '--no-index')?.allowExitCodes,
    ).toEqual([1])
  })

  it('не уходит в --no-index для отслеживаемого файла', async () => {
    const { run, calls } = fakeGit((args) => {
      if (args[0] === 'diff' && args[1] === 'HEAD') {
        return 'diff --git a/x.ts b/x.ts\n+line'
      }
      return null
    })

    const diff = await createGitSource({ run }).diff({
      base: null,
      path: 'x.ts',
      maxLines: 100,
    })

    expect(diff.text).toContain('+line')
    expect(calls.some((call) => call.args[1] === '--no-index')).toBe(false)
  })
})

describe('git MCP server', () => {
  it('exposes only read-only git tools', async () => {
    const listed = await host.listTools()
    expect(listed.ok).toBe(true)
    if (!listed.ok) {
      return
    }
    const git = listed.tools.filter(
      (tool) => tool.server === 'dev-assistant-mcp-git',
    )
    expect(git.map((tool) => tool.name).sort()).toEqual([
      'git_branch',
      'git_changed_files',
      'git_diff',
      'git_log',
      'git_status',
    ])
    expect(git.every((tool) => tool.mutating === false)).toBe(true)
  }, 20_000)

  it('reports the current branch, with and without prose', async () => {
    const result = await host.callToolOnServer('git', 'git_branch', {})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toMatch(/^Текущая ветка:/)
      expect(result.structured?.branch).toBeTypeOf('string')
    }
  }, 20_000)

  it('returns commits and caps the diff', async () => {
    const log = await host.callToolOnServer('git', 'git_log', { limit: 3 })
    expect(log.ok).toBe(true)
    if (log.ok) {
      expect(Array.isArray(log.structured?.commits)).toBe(true)
    }

    const diff = await host.callToolOnServer('git', 'git_diff', {
      maxLines: 5,
    })
    expect(diff.ok).toBe(true)
    if (diff.ok) {
      expect(diff.structured?.truncated).toBeTypeOf('boolean')
      expect(diff.structured?.lines).toBeTypeOf('number')
    }
  }, 20_000)
})
