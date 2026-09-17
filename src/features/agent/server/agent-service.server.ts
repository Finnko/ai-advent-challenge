import {
  AGENT_JUDGES,
  Agent,
} from '../domain/agent'
import type {
  AgentCapabilities,
  AgentRunResult,
  AgentStore,
  AgentTool,
  CallLLM,
  PreparedContext,
} from '../domain/agent'
import { TOOLS_BY_ROLE, createAgentTools } from '../domain/agent-tools'
import type { ContextStrategy } from '../domain/context/types'
import type { ExtractFacts } from '../domain/facts'
import { createExtractFacts } from '../domain/facts'
import type {
  CompressionMessage,
  Summarize,
  SummaryUsage,
} from '../domain/compression'
import { toLlmMessages } from '../domain/compression'
import { createExtractMemories } from '../domain/memory/extract'
import type { ExtractMemories } from '../domain/memory/extract'
import type { MemoryEntry } from '../domain/memory/types'
import {
  applyLongTermLimit,
  buildMemoryBlocks,
  mergeMemoryEntries,
} from '../domain/memory/read'
import { MemoryRouter } from '../domain/memory/router'
import type { ProfileRecord } from '../domain/profile/types'
import { buildProfileBlocks } from '../domain/profile/read'
import {
  callCompletions,
  apiKeyFor,
} from '@lib/llm.server'
import { TIER_ENDPOINTS } from '@lib/llm'
import { estimateMessagesTokens, estimateTokens } from '../domain/tokens'
import {
  createAgentStore,
  getPersonByToken,
  listPeople,
  listSubordinates,
} from './store.server'

export async function resolveCapabilitiesByToken(
  token: string,
): Promise<AgentCapabilities> {
  const person = await getPersonByToken(token)
  if (!person) {
    throw new Error('Неизвестный токен: профиль способностей не найден.')
  }
  const subordinates = await listSubordinates(token)
  const colleagues = await listPeople()
  return {
    identity: {
      name: person.name,
      role: person.role,
      title: person.title,
      subordinates: subordinates.map((s) => s.name),
      colleagues: colleagues.map((c) => c.name),
    },
    allowedTools: TOOLS_BY_ROLE[person.role] ?? [],
  }
}

async function buildAgentContext(
  store: AgentStore,
  capabilities: AgentCapabilities,
): Promise<string | undefined> {
  const contextLines: string[] = []
  const latestBooking = await store.latestManagedBookingFor(
    capabilities.identity.name,
    capabilities.identity.subordinates,
  )
  if (latestBooking) {
    contextLines.push(
      `Последняя доступная встреча (пользователя или команды): ${latestBooking.room}, ${latestBooking.date} ${latestBooking.time} (${latestBooking.durationMin} мин), организатор ${latestBooking.bookedBy}, тема: ${latestBooking.title}.`,
    )
  }
  const pendingVacation = await store.latestPendingVacation(
    capabilities.identity.subordinates,
  )
  if (pendingVacation) {
    contextLines.push(
      `Последняя заявка на отпуск от подчинённых: ${pendingVacation.employeeName}, с ${pendingVacation.start} по ${pendingVacation.end} (ожидает согласования).`,
    )
  }
  return contextLines.length > 0 ? contextLines.join('\n') : undefined
}

const callFlash: CallLLM = async ({
  messages,
  temperature,
  response_format,
  max_tokens,
}) => {
  const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
  const reply = await callCompletions(TIER_ENDPOINTS.medium, apiKey, messages, {
    temperature,
    response_format,
    max_tokens,
  })
  return {
    content: reply.content,
    usage: reply.usage,
    latencyMs: reply.latencyMs ?? 0,
  }
}

const SUMMARY_TEMPERATURE = 0.2

const summarizeHistory: Summarize = async (messages) => {
  const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
  const reply = await callCompletions(TIER_ENDPOINTS.medium, apiKey, messages, {
    temperature: SUMMARY_TEMPERATURE,
  })
  return { content: reply.content, usage: reply.usage }
}

export type AgentRuntime = {
  callLLM: CallLLM
  summarize: Summarize
  extractFacts: ExtractFacts
  extractMemories: ExtractMemories
  store: AgentStore
  createTools: (store: AgentStore, now: Date) => AgentTool[]
}

export const defaultAgentRuntime: AgentRuntime = {
  callLLM: callFlash,
  summarize: summarizeHistory,
  extractFacts: createExtractFacts(callFlash),
  extractMemories: createExtractMemories(callFlash),
  store: createAgentStore(),
  createTools: createAgentTools,
}

export type MemoryOptions = {
  enabled: boolean
  token: string
  sessionId: number
  scenario: string | null
  working: MemoryEntry[]
  longTerm: MemoryEntry[]
  saveWorking: (entries: MemoryEntry[]) => Promise<void> | void
  saveLongTerm: (entries: MemoryEntry[]) => Promise<void> | void
}

export type ExecuteOptions = {
  capabilities: AgentCapabilities
  user: string
  strategy: ContextStrategy
  rows: CompressionMessage[]
  branchLabel?: string
  windowSize?: number
  memory?: MemoryOptions
  profile?: ProfileRecord | null
  now?: Date
}

export type AgentExecution = {
  run: AgentRunResult
  auxUsage: SummaryUsage | null
}

export async function executeAgent(
  options: ExecuteOptions,
  runtime: AgentRuntime = defaultAgentRuntime,
): Promise<AgentExecution> {
  const now = options.now ?? new Date()
  const store = runtime.store
  const context = await buildAgentContext(store, options.capabilities)
  const agent = new Agent({
    capabilities: options.capabilities,
    tools: runtime.createTools(store, now),
    judges: AGENT_JUDGES,
    callLLM: runtime.callLLM,
    model: TIER_ENDPOINTS.medium.model,
    today: todayIso(now),
    responseLanguage: options.profile?.language ?? null,
    context,
  })
  try {
    const memoryBlocks = await prepareMemoryBlocks(options, runtime.extractMemories)
    const profileBlocks = buildProfileBlocks(options.profile ?? null)
    const prepared = await options.strategy.prepare({
      rows: options.rows,
      request: options.user,
      branchLabel: options.branchLabel,
      windowSize: options.windowSize,
    })
    const context: PreparedContext = {
      ...prepared.context,
      blocks: [
        ...profileBlocks,
        ...memoryBlocks.blocks,
        ...prepared.context.blocks,
      ],
    }
    const run = await agent.run(options.user, context)
    return {
      run,
      auxUsage: sumSummaryUsage(prepared.auxUsage, memoryBlocks.usage),
    }
  } catch (error) {
    return { run: blockedRun(options, error), auxUsage: null }
  }
}

async function prepareMemoryBlocks(
  options: ExecuteOptions,
  extractMemories: ExtractMemories,
): Promise<{ blocks: PreparedContext['blocks']; usage: SummaryUsage | null }> {
  const memory = options.memory
  if (!memory?.enabled) {
    return { blocks: [], usage: null }
  }
  const snapshot = { working: memory.working, longTerm: memory.longTerm }
  let next = snapshot
  let usage: SummaryUsage | null = null
  try {
    const extracted = await extractMemories(snapshot, options.user)
    usage = extracted.usage
    const routed = MemoryRouter.route({
      candidates: extracted.candidates,
      scenario: memory.scenario,
    })
    const workingEntries = routed.filter((entry) => entry.layer === 'working')
    const longTermEntries = routed.filter((entry) => entry.layer === 'long-term')
    next = {
      working: mergeMemoryEntries(snapshot.working, workingEntries),
      longTerm: applyLongTermLimit(
        mergeMemoryEntries(snapshot.longTerm, longTermEntries),
      ),
    }
    if (workingEntries.length > 0) {
      await memory.saveWorking(next.working)
    }
    if (longTermEntries.length > 0) {
      await memory.saveLongTerm(next.longTerm)
    }
  } catch {
    next = snapshot
  }
  return { blocks: buildMemoryBlocks(next), usage }
}

function sumSummaryUsage(
  left: SummaryUsage | null,
  right: SummaryUsage | null,
): SummaryUsage | null {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return {
    prompt_tokens: left.prompt_tokens + right.prompt_tokens,
    completion_tokens: left.completion_tokens + right.completion_tokens,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function blockedRun(options: ExecuteOptions, error: unknown): AgentRunResult {
  const message = errorMessage(error)
  const historyTokens = estimateMessagesTokens(toLlmMessages(options.rows))
  return {
    ok: false,
    blocked: true,
    reason: message,
    answer: `Агент не смог обработать запрос: ${message}`,
    trace: [],
    verdicts: [],
    usage: null,
    latencyMs: 0,
    model: TIER_ENDPOINTS.medium.model,
    tokens: {
      requestTokens: estimateTokens(options.user),
      historyTokens,
      historyTokensSent: historyTokens,
      contextTokens: 0,
      contextMessages: 0,
      responseTokens: 0,
      promptTokensActual: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      costUsd: 0,
    },
    contextNote: null,
  }
}

function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
