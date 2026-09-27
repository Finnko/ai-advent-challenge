import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { noneStrategy } from '../domain/context/none'
import type { CallLLM } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import type { McpCallResult, McpToolDescriptor } from '../domain/mcp/types'
import type { SearchResult, WebSource } from '../domain/research/types'
import { createFileReportsStore } from '../mcp/research/reports'
import {
  createResearchToolkit,
  type ResearchToolResult,
} from '../mcp/research/tools'
import { executeAgent } from '../server/agent-service.server'
import type { AgentRuntime } from '../server/agent-service.server'
import {
  createCapabilities,
  createFakeStore,
  createIdentity,
} from './agent-testkit'

const SEARCH_TOKEN = 'Курс EUR/USD 1.08'

const DESCRIPTORS: McpToolDescriptor[] = [
  {
    name: 'search',
    title: 'Поиск',
    description: 'Ищет.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    server: 'agent-mcp-research',
  },
  {
    name: 'summarize',
    title: 'Краткое содержание',
    description: 'Сжимает.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' }, maxSentences: { type: 'integer' } },
      required: ['text'],
    },
    server: 'agent-mcp-research',
  },
  {
    name: 'save_to_file',
    title: 'Сохранить',
    description: 'Пишет файл.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, content: { type: 'string' } },
      required: ['name', 'content'],
    },
    server: 'agent-mcp-research',
  },
]

function fakeWeb(): WebSource {
  const results: SearchResult[] = [
    {
      title: 'Евро',
      url: 'https://ru.wikipedia.org/wiki/Евро',
      snippet: `${SEARCH_TOKEN}. Европейская валюта растёт третий день подряд.`,
    },
    {
      title: 'Доллар США',
      url: 'https://ru.wikipedia.org/wiki/Доллар_США',
      snippet: 'Американская валюта снижается к евро. Рынок ждёт статистику.',
    },
  ]
  return {
    async search() {
      return results
    },
  }
}

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

describe('MCP pipeline: search → summarize → save_to_file', () => {
  it('выполняет цепочку и передаёт данные между инструментами', async () => {
    dir = mkdtempSync(join(tmpdir(), 'chain-reports-'))
    const toolkit = createResearchToolkit({
      web: fakeWeb(),
      reports: createFileReportsStore(dir),
    })
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const outputs: Record<string, string> = {}

    const runTool = (
      name: string,
      args: Record<string, unknown>,
    ): Promise<ResearchToolResult> => {
      if (name === 'search') {
        return toolkit.search(args)
      }
      if (name === 'summarize') {
        return toolkit.summarize(args)
      }
      return toolkit.saveToFile(args)
    }

    const call = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<McpCallResult> => {
      calls.push({ name, args })
      const result = await runTool(name, args)
      if (!result.ok) {
        return { ok: false, error: result.text }
      }
      outputs[name] = result.text
      return { ok: true, text: result.text }
    }

    const tools = buildMcpAgentTools(DESCRIPTORS, call)
    const steps = [
      () => ({ tool: 'mcp_search', args: { query: 'курс евро доллар' } }),
      () => ({
        tool: 'mcp_summarize',
        args: { text: outputs.search, maxSentences: 2 },
      }),
      () => ({
        tool: 'mcp_save_to_file',
        args: { name: 'euro-report', content: outputs.summarize },
      }),
      () => ({ tool: null, args: {} }),
    ]

    const runtime: AgentRuntime = {
      callLLM: scriptedChain(steps, 'Готово: отчёт сохранён в файл.'),
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
        user: 'Собери мини-отчёт по евро/доллар и сохрани в файл.',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    expect(execution.run.answer).toContain('отчёт сохранён')

    const acts = execution.run.trace.filter((step) => step.stage === 'act')
    expect(acts.map((step) => step.tool)).toEqual([
      'mcp_search',
      'mcp_summarize',
      'mcp_save_to_file',
    ])
    expect(calls.map((entry) => entry.name)).toEqual([
      'search',
      'summarize',
      'save_to_file',
    ])

    expect(outputs.search).toContain(SEARCH_TOKEN)
    expect(calls[1].args.text).toBe(outputs.search)
    expect(calls[2].args.content).toBe(outputs.summarize)

    const savedPath = join(dir, 'euro-report.md')
    expect(existsSync(savedPath)).toBe(true)
    const saved = readFileSync(savedPath, 'utf8')
    expect(saved).toBe(outputs.summarize)
    expect(outputs.summarize.length).toBeGreaterThan(0)
    expect(outputs.summarize.length).toBeLessThan(outputs.search.length)
  })
})
