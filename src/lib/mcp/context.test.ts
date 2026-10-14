import { describe, expect, it } from 'vitest'
import type { SpawnConfig } from './client.server'
import { collectMcpContext, type McpContextCall } from './context.server'
import type { McpCallResult, ToolArgs } from './types'

const CALLS: McpContextCall[] = [
  { name: 'git_branch', title: 'Ветка', args: {} },
  { name: 'git_status', title: 'Статус', args: {} },
]

function config(name: string): SpawnConfig {
  return { name, entry: 'fake.ts', childEnv: () => undefined }
}

function recorder(results: McpCallResult[]) {
  const seen: ToolArgs[][] = []
  const run = async (_config: SpawnConfig, calls: { args: ToolArgs }[]) => {
    seen.push(calls.map((call) => call.args))
    return results
  }
  return { seen, run }
}

describe('collectMcpContext', () => {
  it('maps tool results into titled sections with structured payloads', async () => {
    const { run } = recorder([
      { ok: true, text: 'Текущая ветка: main', structured: { branch: 'main' } },
      { ok: true, text: 'Рабочее дерево чистое', structured: { clean: true } },
    ])

    const context = await collectMcpContext({
      config: config('sections'),
      calls: CALLS,
      run,
    })

    expect(context.available).toBe(true)
    expect(context.error).toBeNull()
    expect(context.sections.map((section) => section.title)).toEqual([
      'Ветка',
      'Статус',
    ])
    expect(context.sections[0].structured).toEqual({ branch: 'main' })
    expect(context.block).toBe(
      '### Ветка\nТекущая ветка: main\n\n### Статус\nРабочее дерево чистое',
    )
  })

  it('degrades to an error when every tool call fails', async () => {
    const { run } = recorder([
      { ok: false, error: 'нет git' },
      { ok: false, error: 'тоже нет' },
    ])

    const context = await collectMcpContext({
      config: config('degraded'),
      calls: CALLS,
      run,
    })

    expect(context.available).toBe(false)
    expect(context.error).toBe('нет git')
    expect(context.sections).toEqual([])
    expect(context.block).toBeNull()
  })

  it('collapses concurrent callers into a single spawn', async () => {
    const { seen, run } = recorder([
      { ok: true, text: 'Ветка', structured: { branch: 'main' } },
      { ok: true, text: 'Статус', structured: { clean: true } },
    ])

    const options = { config: config('deduped'), calls: CALLS, run }
    const [first, second] = await Promise.all([
      collectMcpContext(options),
      collectMcpContext(options),
    ])

    expect(seen).toHaveLength(1)
    expect(first).toBe(second)
  })

  it('runs again once the ttl has passed', async () => {
    const { seen, run } = recorder([
      { ok: true, text: 'Ветка', structured: { branch: 'main' } },
      { ok: true, text: 'Статус', structured: { clean: true } },
    ])
    let clock = 0
    const options = {
      config: config('ttl'),
      calls: CALLS,
      run,
      ttlMs: 100,
      now: () => clock,
    }

    await collectMcpContext(options)
    await collectMcpContext(options)
    expect(seen).toHaveLength(1)

    clock = 1000
    await collectMcpContext(options)
    expect(seen).toHaveLength(2)
  })
})
