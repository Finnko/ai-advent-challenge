import {
  AGENT_JUDGES,
  Agent,
} from './agent'
import type {
  AgentCapabilities,
  AgentRunResult,
  AgentStore,
  CallLLM,
} from './agent'
import { TOOLS_BY_ROLE, createAgentTools } from './agent-tools'
import type { ContextStrategy } from './context/types'
import type {
  CompressionMessage,
  PreviousSummary,
  Summarize,
  SummaryUsage,
} from './compression'
import { toLlmMessages } from './compression'
import {
  callCompletions,
  apiKeyFor,
} from './llm.server'
import { TIER_ENDPOINTS } from './llm'
import { estimateMessagesTokens, estimateTokens } from './tokens'
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

export type ExecuteOptions = {
  capabilities: AgentCapabilities
  user: string
  strategy: ContextStrategy
  rows: CompressionMessage[]
  previousSummary: PreviousSummary | null
  saveSummary: (
    summary: string,
    throughMessageId: number,
  ) => Promise<void> | void
}

export type AgentExecution = {
  run: AgentRunResult
  auxUsage: SummaryUsage | null
}

export async function executeAgent(
  options: ExecuteOptions,
): Promise<AgentExecution> {
  const store = createAgentStore()
  const context = await buildAgentContext(store, options.capabilities)
  const agent = new Agent({
    capabilities: options.capabilities,
    tools: createAgentTools(store),
    judges: AGENT_JUDGES,
    callLLM: callFlash,
    model: TIER_ENDPOINTS.medium.model,
    today: todayIso(),
    context,
  })
  try {
    const prepared = await options.strategy.prepare({
      rows: options.rows,
      previousSummary: options.previousSummary,
      summarize: summarizeHistory,
      saveSummary: options.saveSummary,
    })
    const run = await agent.run(options.user, prepared.context)
    return { run, auxUsage: prepared.auxUsage }
  } catch (error) {
    return { run: blockedRun(options, error), auxUsage: null }
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

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
