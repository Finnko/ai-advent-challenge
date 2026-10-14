import { describe, expect, it } from 'vitest'
import { createMcpHost } from '@lib/mcp/client.server'
import { devAssistantMcpRegistry } from '../server/mcp-registry.server'

const host = createMcpHost(devAssistantMcpRegistry)

describe('git MCP server', () => {
  it('exposes only read-only git tools', async () => {
    const listed = await host.listTools()
    expect(listed.ok).toBe(true)
    if (!listed.ok) {
      return
    }
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      'git_branch',
      'git_changed_files',
      'git_diff',
      'git_log',
      'git_status',
    ])
    expect(listed.tools.every((tool) => tool.mutating === false)).toBe(true)
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
