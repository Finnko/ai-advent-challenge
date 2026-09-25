import { describe, expect, it } from 'vitest'
import type { CallLLM, LlmMessage } from '../domain/agent'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import { formatArgsExample } from '../domain/mcp/args-example'
import type { McpToolDescriptor } from '../domain/mcp/types'
import { noneStrategy } from '../domain/context/none'
import { executeAgent } from '../server/agent-service.server'
import type { AgentRuntime } from '../server/agent-service.server'
import {
  createCapabilities,
  createFakeStore,
  createIdentity,
} from './agent-testkit'

const OVERVIEW: McpToolDescriptor = {
  name: 'db_overview',
  title: 'Обзор базы агента',
  description: 'Счётчики записей по таблицам.',
  inputSchema: { type: 'object', properties: {}, required: [] },
}

function scriptedLLM(
  captured: LlmMessage[][],
  decide: string,
  finalize: string,
): CallLLM {
  return async ({ messages, response_format }) => {
    captured.push(messages)
    return {
      content: response_format ? decide : finalize,
      usage: { prompt_tokens: 3, completion_tokens: 2 },
      latencyMs: 0,
    }
  }
}

function unused(): never {
  throw new Error('runtime helper не должен вызываться в этом тесте')
}

describe('MCP → agent adapter', () => {
  it('строит пример аргументов из JSON-схемы', () => {
    expect(
      formatArgsExample({
        type: 'object',
        properties: {
          employeeName: { type: 'string' },
          from: { type: 'string' },
        },
        required: ['employeeName'],
      }),
    ).toBe('{ "employeeName": "<строка>", "from": "<строка>" }')

    expect(
      formatArgsExample({ type: 'object', properties: {}, required: [] }),
    ).toBe('{}')

    expect(
      formatArgsExample({ type: 'object', properties: { limit: { type: 'integer' } } }),
    ).toContain('(все поля необязательны)')
  })

  it('оборачивает descriptor в AgentTool с префиксом и ролями', async () => {
    const tools = buildMcpAgentTools([OVERVIEW], async () => ({
      ok: true,
      text: 'Брони переговорок: 1',
    }))

    expect(tools).toHaveLength(1)
    const tool = tools[0]
    expect(tool.name).toBe('mcp_db_overview')
    expect(tool.description).toBe('Счётчики записей по таблицам.')
    expect(tool.roles).toEqual(['employee', 'manager'])

    const outcome = await tool.run({}, createIdentity())
    expect(outcome).toEqual({
      ok: true,
      text: 'Брони переговорок: 1',
      reference: null,
    })
  })

  it('превращает ошибку MCP в неуспешный результат инструмента', async () => {
    const tools = buildMcpAgentTools([OVERVIEW], async () => ({
      ok: false,
      error: 'процесс упал',
    }))
    const outcome = await tools[0].run({}, createIdentity())
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('MCP: процесс упал')
  })

  it('агент вызывает MCP-инструмент и использует его результат', async () => {
    const captured: LlmMessage[][] = []
    const mcpTools = buildMcpAgentTools([OVERVIEW], async () => ({
      ok: true,
      text: 'Брони переговорок: 1',
    }))
    const runtime: AgentRuntime = {
      callLLM: scriptedLLM(
        captured,
        JSON.stringify({ tool: 'mcp_db_overview', args: {} }),
        'Всего броней переговорок: 1 (из MCP).',
      ),
      summarize: unused,
      extractFacts: unused,
      extractMemories: async () => ({ candidates: [], usage: null }),
      analyzeTaskState: async () => ({ analysis: null, usage: null }),
      store: createFakeStore(),
      createTools: () => [],
      loadMcpTools: async () => mcpTools,
    }

    const execution = await executeAgent(
      {
        capabilities: createCapabilities(createIdentity(), []),
        user: 'Сколько всего броней?',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    expect(execution.run.answer).toContain('Всего броней переговорок: 1')
    const act = execution.run.trace.find((step) => step.stage === 'act')
    expect(act && act.stage === 'act' ? act.tool : null).toBe('mcp_db_overview')
    expect(act && act.stage === 'act' ? act.outcome.text : '').toContain(
      'Брони переговорок: 1',
    )

    const decidePrompt = captured
      .flat()
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n')
    expect(decidePrompt).toContain('mcp_db_overview')
  })

  it('не ломается, если MCP-сервер недоступен', async () => {
    const captured: LlmMessage[][] = []
    const runtime: AgentRuntime = {
      callLLM: scriptedLLM(captured, '{"tool":null,"args":{}}', 'Обычный ответ.'),
      summarize: unused,
      extractFacts: unused,
      extractMemories: async () => ({ candidates: [], usage: null }),
      analyzeTaskState: async () => ({ analysis: null, usage: null }),
      store: createFakeStore(),
      createTools: () => [],
      loadMcpTools: async () => [],
    }

    const execution = await executeAgent(
      {
        capabilities: createCapabilities(createIdentity(), []),
        user: 'Привет',
        strategy: noneStrategy,
        rows: [],
      },
      runtime,
    )

    expect(execution.run.ok).toBe(true)
    expect(execution.run.answer).toContain('Обычный ответ.')
  })
})
