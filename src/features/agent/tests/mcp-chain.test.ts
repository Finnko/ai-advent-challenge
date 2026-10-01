import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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
    mutating: false,
  },
  {
    name: 'summarize',
    title: 'Краткое содержание',
    description: 'Сжимает.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        maxSentences: { type: 'integer' },
      },
      required: ['text'],
    },
    server: 'agent-mcp-research',
    mutating: false,
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
    mutating: true,
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

function variableWeb(): WebSource {
  let calls = 0
  const short: SearchResult[] = [
    {
      title: 'Евро',
      url: 'https://ru.wikipedia.org/wiki/Евро',
      snippet: `${SEARCH_TOKEN}. Курс евро вырос.`,
    },
  ]
  const long: SearchResult[] = [
    {
      title: 'Евро',
      url: 'https://ru.wikipedia.org/wiki/Евро',
      snippet: Array.from(
        { length: 20 },
        (_, index) =>
          `Факт номер ${index + 1} про евро и валютную политику ЕЦБ.`,
      ).join(' '),
    },
  ]
  return {
    async search() {
      calls += 1
      return calls === 1 ? short : long
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

  it('передаёт данные между инструментами ссылками $ref, не копируя текст в decide', async () => {
    dir = mkdtempSync(join(tmpdir(), 'chain-ref-'))
    const toolkit = createResearchToolkit({
      web: fakeWeb(),
      reports: createFileReportsStore(dir),
    })
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const outputs: Record<string, string> = {}
    let largestDecideChars = 0

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
        args: { text: { $ref: '1' }, targetWords: 2 },
      }),
      () => ({
        tool: 'mcp_save_to_file',
        args: { name: 'euro-ref', content: { $ref: 'last' } },
      }),
      () => ({ tool: null, args: {} }),
    ]

    const base = scriptedChain(steps, 'Готово: отчёт сохранён по ссылке.')
    const callLLM: CallLLM = async (params) => {
      const reply = await base(params)
      if (params.response_format) {
        largestDecideChars = Math.max(largestDecideChars, reply.content.length)
      }
      return reply
    }

    const runtime: AgentRuntime = {
      callLLM,
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
    const acts = execution.run.trace.filter((step) => step.stage === 'act')
    expect(acts.map((step) => step.tool)).toEqual([
      'mcp_search',
      'mcp_summarize',
      'mcp_save_to_file',
    ])
    expect(outputs.search).toContain(SEARCH_TOKEN)
    expect(calls[1].args.text).toBe(outputs.search)
    expect(calls[2].args.content).toBe(outputs.summarize)

    const savedPath = join(dir, 'euro-ref.md')
    expect(existsSync(savedPath)).toBe(true)
    expect(readFileSync(savedPath, 'utf8')).toBe(outputs.summarize)
    expect(largestDecideChars).toBeLessThan(300)
  })

  it('сохраняет полный вывод MCP по ссылке при длинном preview', async () => {
    dir = mkdtempSync(join(tmpdir(), 'chain-long-ref-'))
    const fullSummary = `Курс и погода.\n${'Брони по переговоркам: Ладога — 6. '.repeat(140)}`
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []

    const call = async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<McpCallResult> => {
      calls.push({ name, args })
      if (name === 'search') {
        return { ok: true, text: 'исходные данные' }
      }
      if (name === 'summarize') {
        return { ok: true, text: fullSummary }
      }
      const path = join(dir, 'long-report.md')
      writeFileSync(path, String(args.content))
      return { ok: true, text: `Сохранено: ${path}` }
    }

    const tools = buildMcpAgentTools(DESCRIPTORS, call)
    const steps = [
      () => ({ tool: 'mcp_search', args: { query: 'курс евро' } }),
      () => ({
        tool: 'mcp_summarize',
        args: { text: { $ref: '1' } },
      }),
      () => ({
        tool: 'mcp_save_to_file',
        args: { name: 'long-report', content: { $ref: 'last' } },
      }),
      () => ({ tool: null, args: {} }),
    ]
    const runtime: AgentRuntime = {
      callLLM: scriptedChain(steps, 'Готово: длинный отчёт сохранён.'),
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
        user: 'Собери длинный отчёт и сохрани в файл.',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    expect(calls[2].args.content).toBe(fullSummary)
    expect(readFileSync(join(dir, 'long-report.md'), 'utf8')).toBe(fullSummary)
  })

  it('добирает источники, пока не наберёт targetWords, и сохраняет чистый отчёт', async () => {
    dir = mkdtempSync(join(tmpdir(), 'chain-volume-'))
    const toolkit = createResearchToolkit({
      web: variableWeb(),
      reports: createFileReportsStore(dir),
    })
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const outputs: Record<string, string> = {}
    const resultTexts: string[] = []

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
      resultTexts.push(result.text)
      return { ok: true, text: result.text }
    }

    const tools = buildMcpAgentTools(DESCRIPTORS, call)
    const steps = [
      () => ({ tool: 'mcp_search', args: { query: 'курс евро' } }),
      () => ({
        tool: 'mcp_summarize',
        args: { text: outputs.search, targetWords: 60 },
      }),
      () => ({ tool: 'mcp_search', args: { query: 'евро ЕЦБ', full: true } }),
      () => ({
        tool: 'mcp_summarize',
        args: { text: outputs.search, targetWords: 60 },
      }),
      () => ({
        tool: 'mcp_save_to_file',
        args: { name: 'euro-volume', content: outputs.summarize },
      }),
      () => ({ tool: null, args: {} }),
    ]

    const runtime: AgentRuntime = {
      callLLM: scriptedChain(steps, 'Готово: отчёт сохранён.'),
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
        user: 'Собери отчёт по евро на 60 слов и сохрани.',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    const acts = execution.run.trace.filter((step) => step.stage === 'act')
    expect(acts.map((step) => step.tool)).toEqual([
      'mcp_search',
      'mcp_summarize',
      'mcp_search',
      'mcp_summarize',
      'mcp_save_to_file',
    ])
    expect(resultTexts[1]).toContain('[Объём:')
    expect(resultTexts[3]).not.toContain('[Объём:')

    const savedPath = join(dir, 'euro-volume.md')
    expect(existsSync(savedPath)).toBe(true)
    const saved = readFileSync(savedPath, 'utf8')
    expect(saved).not.toContain('[Объём:')
    expect(saved).toBe(outputs.summarize)
  })
})
