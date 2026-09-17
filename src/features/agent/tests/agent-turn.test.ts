import { describe, expect, it } from 'vitest'
import type {
  AgentCapabilities,
  CallLLM,
  LlmMessage,
} from '../domain/agent'
import type { MemoryEntry } from '../domain/memory/types'
import type { AgentRuntime } from '../server/agent-service.server'
import { runAgentTurn } from '../server/agent-turn.server'
import type { TurnDeps, TurnSession, TurnStore } from '../server/agent-turn.server'
import { TEST_NOW, createFakeStore } from './agent-testkit'

type AppendedMessage = {
  role: 'user' | 'assistant'
  content: string
  run?: unknown
}

function turnSession(overrides: Partial<TurnSession> = {}): TurnSession {
  return {
    token: 'tok-test',
    strategy: 'none',
    scenario: null,
    windowSize: 10,
    memoryEnabled: false,
    profileId: null,
    taskStateEnabled: false,
    invariantSetId: null,
    ...overrides,
  }
}

function createTurnStore(session: TurnSession) {
  const appended: AppendedMessage[] = []
  const savedWorking: MemoryEntry[][] = []
  const savedLongTerm: MemoryEntry[][] = []
  const store: TurnStore = {
    async getSession() {
      return session
    },
    async getActiveBranchTitle() {
      return undefined
    },
    async loadMessages() {
      return []
    },
    async getSummary() {
      return null
    },
    async saveSummary() {},
    async getFacts() {
      return []
    },
    async saveFacts() {},
    async getWorkingMemory() {
      return []
    },
    async getLongTermMemory() {
      return []
    },
    async saveWorkingMemory(_sessionId, entries) {
      savedWorking.push(entries)
    },
    async saveLongTermMemory(_token, entries) {
      savedLongTerm.push(entries)
    },
    async getProfile() {
      return null
    },
    async appendMessage(_sessionId, role, content, run) {
      appended.push({ role, content, run })
    },
  }
  return { store, appended, savedWorking, savedLongTerm }
}

function scriptedCallLLM(captured: LlmMessage[][]): CallLLM {
  return async ({ messages, response_format }) => {
    captured.push(messages)
    return {
      content: response_format ? '{"tool": null, "args": {}}' : 'Готово.',
      usage: { prompt_tokens: 3, completion_tokens: 2 },
      latencyMs: 0,
    }
  }
}

function makeRuntime(overrides: Partial<AgentRuntime> = {}): {
  runtime: AgentRuntime
  captured: LlmMessage[][]
} {
  const captured: LlmMessage[][] = []
  const unused = async () => {
    throw new Error('runtime helper не должен вызываться в этом тесте')
  }
  const runtime: AgentRuntime = {
    callLLM: scriptedCallLLM(captured),
    summarize: unused,
    extractFacts: unused,
    extractMemories: async () => ({ candidates: [], usage: null }),
    store: createFakeStore(),
    createTools: () => [],
    ...overrides,
  }
  return { runtime, captured }
}

const capabilities: AgentCapabilities = {
  identity: {
    name: 'Пётр',
    role: 'employee',
    title: 'Линейный сотрудник',
    subordinates: [],
    colleagues: [],
  },
  allowedTools: [],
}

function deps(
  store: TurnStore,
  runtime: AgentRuntime,
): TurnDeps {
  return {
    resolveCapabilities: async () => capabilities,
    store,
    runtime,
    now: () => TEST_NOW,
  }
}

describe('runAgentTurn', () => {
  it('отклоняет чужую сессию', async () => {
    const { store } = createTurnStore(turnSession({ token: 'other-token' }))
    const { runtime } = makeRuntime()

    await expect(
      runAgentTurn(
        { token: 'tok-test', sessionId: 7, user: 'привет' },
        deps(store, runtime),
      ),
    ).rejects.toThrow('Сессия не найдена')
  })

  it('гидратирует состояние, выполняет Ход и сохраняет две реплики', async () => {
    const { store, appended, savedWorking, savedLongTerm } =
      createTurnStore(turnSession())
    const { runtime } = makeRuntime()

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'привет' },
      deps(store, runtime),
    )

    expect(result.run.ok).toBe(true)
    expect(result.run.answer).toBe('Готово.')
    expect(appended.map((message) => [message.role, message.content])).toEqual([
      ['user', 'привет'],
      ['assistant', 'Готово.'],
    ])
    expect(appended[1].run).toBe(result.run)
    expect(savedWorking).toEqual([])
    expect(savedLongTerm).toEqual([])
  })

  it('при включённой памяти извлекает, сохраняет и добавляет блок в промпт', async () => {
    const { store, savedWorking, savedLongTerm } = createTurnStore(
      turnSession({ memoryEnabled: true }),
    )
    const { runtime, captured } = makeRuntime({
      extractMemories: async () => ({
        candidates: [{ layer: 'working', key: 'Цель', value: 'запуск' }],
        usage: null,
      }),
    })

    const result = await runAgentTurn(
      { token: 'tok-test', sessionId: 7, user: 'зафиксируй цель' },
      deps(store, runtime),
    )

    expect(result.run.ok).toBe(true)
    expect(savedWorking).toHaveLength(1)
    expect(savedWorking[0].map((entry) => entry.key)).toEqual(['Цель'])
    expect(savedLongTerm).toEqual([])

    const systemContents = captured
      .flat()
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
    expect(
      systemContents.some((content) =>
        content.includes('РАБОЧАЯ ПАМЯТЬ ЗАДАЧИ:'),
      ),
    ).toBe(true)
  })
})
