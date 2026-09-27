import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { noneStrategy } from '../domain/context/none'
import type { CallLLM } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import type { JsonValue, McpCallResult, McpToolDescriptor } from '../domain/mcp/types'
import { executeAgent } from '../server/agent-service.server'
import type { AgentRuntime } from '../server/agent-service.server'
import {
  createCapabilities,
  createFakeStore,
  createIdentity,
} from './agent-testkit'

function descriptor(
  name: string,
  server: string,
  properties: Record<string, JsonValue>,
  mutating = false,
): McpToolDescriptor {
  return {
    name,
    title: name,
    description: `Тул ${name}.`,
    inputSchema: { type: 'object', properties, required: [] },
    server,
    mutating,
  }
}

const DESCRIPTORS: McpToolDescriptor[] = [
  descriptor('db_overview', 'agent-mcp-demo', {}),
  descriptor('exchange_rate', 'agent-mcp-market', { base: { type: 'string' } }),
  descriptor('get_weather_report', 'agent-mcp-jobs', { city: { type: 'string' } }),
  descriptor('search', 'agent-mcp-research', { query: { type: 'string' } }),
  descriptor('summarize', 'agent-mcp-research', {
    text: { type: 'string' },
    maxSentences: { type: 'integer' },
  }),
  descriptor(
    'save_to_file',
    'agent-mcp-research',
    {
      name: { type: 'string' },
      content: { type: 'string' },
    },
    true,
  ),
  descriptor('list_reports', 'agent-mcp-research', {}),
]

function scriptedChain(
  steps: Array<() => { tool: string | null; args: Record<string, unknown> }>,
  finalize: string,
): CallLLM {
  let index = 0
  return async ({ response_format }) => {
    if (!response_format) {
      return {
        content: finalize,
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        latencyMs: 0,
      }
    }
    const step = steps[Math.min(index, steps.length - 1)]
    index += 1
    return {
      content: JSON.stringify(step()),
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      latencyMs: 0,
    }
  }
}

function unused(): never {
  throw new Error('runtime helper не должен вызываться в этом тесте')
}

let dir: string

afterAll(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('MCP orchestration across servers', () => {
  it('выбирает инструменты разных серверов и ведёт длинный флоу', async () => {
    dir = mkdtempSync(join(tmpdir(), 'orchestration-'))
    const outputs: Record<string, string> = {}
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []

    const handlers: Record<
      string,
      (args: Record<string, unknown>) => Promise<McpCallResult>
    > = {
      async db_overview() {
        return { ok: true, text: 'Брони переговорок: 1' }
      },
      async exchange_rate() {
        return { ok: true, text: '1 EUR = 1.08 USD (2026-09-25)' }
      },
      async get_weather_report() {
        return { ok: true, text: 'Москва за 24 ч: сред. +15 °C' }
      },
      async search() {
        return { ok: true, text: 'Свежие новости: евро укрепился к доллару.' }
      },
      async summarize(args) {
        return { ok: true, text: `Кратко: ${String(args.text)}` }
      },
      async save_to_file(args) {
        const name = String(args.name)
        const file = name.endsWith('.md') ? name : `${name}.md`
        writeFileSync(join(dir, file), String(args.content))
        return { ok: true, text: `Сохранено: ${join(dir, file)}` }
      },
      async list_reports() {
        return { ok: true, text: 'Отчёты: euro-report.md' }
      },
    }

    const call = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<McpCallResult> => {
      calls.push({ name, args })
      const handler = handlers[name]
      if (!handler) {
        return { ok: false, error: `нет обработчика ${name}` }
      }
      const result = await handler(args)
      if (result.ok) {
        outputs[name] = result.text
      }
      return result
    }

    const tools = buildMcpAgentTools(DESCRIPTORS, call)
    const steps = [
      () => ({ tool: 'mcp_db_overview', args: {} }),
      () => ({ tool: 'mcp_exchange_rate', args: { base: 'EUR', quote: 'USD' } }),
      () => ({
        tool: 'mcp_get_weather_report',
        args: { city: 'Москва' },
      }),
      () => ({ tool: 'mcp_search', args: { query: 'новости евро' } }),
      () => ({
        tool: 'mcp_summarize',
        args: {
          text: `${outputs.db_overview}; ${outputs.exchange_rate}; ${outputs.get_weather_report}; ${outputs.search}`,
          maxSentences: 3,
        },
      }),
      () => ({
        tool: 'mcp_save_to_file',
        args: { name: 'euro-report', content: outputs.summarize },
      }),
      () => ({ tool: 'mcp_list_reports', args: {} }),
      () => ({ tool: null, args: {} }),
    ]

    const runtime: AgentRuntime = {
      callLLM: scriptedChain(steps, 'Готово: мини-отчёт сохранён и проверен.'),
      summarize: unused,
      extractFacts: unused,
      extractMemories: async () => ({ candidates: [], usage: null }),
      analyzeTaskState: async () => ({ analysis: null, usage: null }),
      store: createFakeStore(),
      createTools: () => [],
      loadMcpTools: async () => tools,
    }

    const execution = await executeAgent(
      {
        capabilities: createCapabilities(createIdentity(), []),
        user:
          'Собери мини-отчёт по евро/доллар: новости, курс, погода, и сохрани в файл.',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    expect(execution.run.answer).toContain('мини-отчёт')

    const acts = execution.run.trace.filter((step) => step.stage === 'act')
    expect(acts.map((step) => step.tool)).toEqual([
      'mcp_db_overview',
      'mcp_exchange_rate',
      'mcp_get_weather_report',
      'mcp_search',
      'mcp_summarize',
      'mcp_save_to_file',
      'mcp_list_reports',
    ])
    expect(calls.map((entry) => entry.name)).toEqual([
      'db_overview',
      'exchange_rate',
      'get_weather_report',
      'search',
      'summarize',
      'save_to_file',
      'list_reports',
    ])

    expect(calls[4].args.text).toContain('1 EUR = 1.08 USD')
    expect(calls[4].args.text).toContain('Москва')
    expect(calls[4].args.text).toContain('новости')
    expect(calls[5].args.content).toBe(outputs.summarize)

    const savedPath = join(dir, 'euro-report.md')
    expect(existsSync(savedPath)).toBe(true)
    expect(readFileSync(savedPath, 'utf8')).toBe(outputs.summarize)

    const descriptions = tools.map((tool) => tool.description)
    expect(descriptions).toContain('[demo] Тул db_overview.')
    expect(descriptions).toContain('[market] Тул exchange_rate.')
    expect(descriptions).toContain('[jobs] Тул get_weather_report.')
    expect(descriptions).toContain('[research] Тул search.')
  })
})
