import {
  answerFromSources,
  resolveAnswerLlm,
  searchSources,
  type AnswerLlm,
  type RagIndexStore,
  type SourcesOutcome,
} from '@lib/rag-engine.server'
import {
  openMcpSession,
  type McpSession,
  type OpenSessionResult,
} from '@lib/mcp/client.server'
import type {
  AnswerGenerator,
  Embedder,
  SearchScope,
} from '@lib/rag-engine.types'
import { SUPPORT_K, SUPPORT_STRATEGY } from '../domain/constants'
import { looksAbstained } from '../domain/answer-check'
import { SupportError, isSupportError } from '../domain/errors'
import { SUPPORT_PERSONA } from '../domain/persona'
import { buildTicketContext } from '../domain/ticket-context'
import type {
  AskRequest,
  AskResult,
  SellerSummary,
  TicketSummary,
} from '../domain/types'
import { resolveSupportGenerator } from './config.server'
import { assertSupportIndex } from './index.server'
import { collectSupportContext, type SupportContext } from './mcp-tools.server'
import { ozonServerConfig } from './mcp-registry.server'
import { getSupportStore } from './store.server'

const SUPPORT_SCOPE: SearchScope = {
  strategy: SUPPORT_STRATEGY,
  k: SUPPORT_K,
  rerank: false,
  rewrite: false,
}

const SUPPORT_MAX_TOKENS = 1800

export type AskSupportDeps = {
  store?: RagIndexStore
  session?: McpSession
  openSession?: () => Promise<OpenSessionResult>
  generator?: AnswerGenerator
  llm?: AnswerLlm
  embedder?: Embedder
  signal?: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.toLowerCase().includes('abort'))
  )
}

function sellerSummary(value: {
  id: string
  name: string
  status: SellerSummary['status']
  tariff: string
  scheme: SellerSummary['scheme']
}): SellerSummary {
  return {
    id: value.id,
    name: value.name,
    status: value.status,
    tariff: value.tariff,
    scheme: value.scheme,
  }
}

function ticketSummary(value: {
  id: string
  sellerId: string
  subject: string
  status: TicketSummary['status']
  createdAt: string
}): TicketSummary {
  return {
    id: value.id,
    sellerId: value.sellerId,
    subject: value.subject,
    status: value.status,
    createdAt: value.createdAt,
  }
}

function withSignal(
  llm: AnswerLlm,
  signal: AbortSignal | undefined,
): AnswerLlm {
  return (messages, options) =>
    llm(messages, {
      ...options,
      maxTokens: options?.maxTokens ?? SUPPORT_MAX_TOKENS,
      signal,
    })
}

async function openSupportSession(
  deps: AskSupportDeps,
): Promise<OpenSessionResult> {
  if (deps.session) {
    return { ok: true, session: deps.session }
  }
  if (deps.openSession) {
    return deps.openSession()
  }
  const config = ozonServerConfig()
  if (!config) {
    return { ok: false, error: 'MCP-сервер Ozon не сконфигурирован.' }
  }
  return openMcpSession(config)
}

export async function askSupport(
  input: AskRequest,
  deps: AskSupportDeps = {},
): Promise<AskResult> {
  const store = deps.store ?? (await getSupportStore())
  try {
    assertSupportIndex(store)
  } catch {
    throw new SupportError(
      'index_missing',
      'База знаний Ozon не проиндексирована.',
      503,
      30,
    )
  }

  const opened = await openSupportSession(deps)
  const owned = !deps.session && opened.ok
  let contextError: string | null = null
  let context: SupportContext | null = null

  try {
    if (!opened.ok) {
      contextError = opened.error
    } else {
      try {
        context = await collectSupportContext(opened.session, {
          sellerId: input.sellerId,
          ticketId: input.ticketId,
        })
      } catch (error) {
        if (isSupportError(error)) {
          throw error
        }
        contextError = error instanceof Error ? error.message : String(error)
      }
    }
  } finally {
    if (owned && opened.ok) {
      await opened.session.close()
    }
  }

  const contextBlocks = context
    ? buildTicketContext({
        seller: context.seller,
        ticket: context.ticket,
        finance: context.finance,
        postings: context.postings,
        product: context.product,
      })
    : []

  const generator = deps.generator ?? resolveSupportGenerator()
  const baseLlm = deps.llm ?? resolveAnswerLlm(generator)
  const llm = withSignal(baseLlm, deps.signal)

  let retrieval: SourcesOutcome
  try {
    retrieval = await searchSources({
      scope: SUPPORT_SCOPE,
      query: input.question,
      store,
      embedder: deps.embedder,
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new SupportError('timeout', 'Запрос к модели прерван.', 504)
    }
    throw error
  }

  try {
    const answer = await answerFromSources({
      question: input.question,
      persona: SUPPORT_PERSONA,
      retrieval,
      contextBlocks,
      generator,
      llm,
    })
    const abstained = answer.abstained || looksAbstained(answer.answer)
    return {
      question: input.question,
      answer: answer.answer,
      format: answer.format,
      abstained,
      generator,
      model: answer.model,
      usage: answer.usage,
      latencyMs: answer.latencyMs,
      reranked: retrieval.reranked,
      sources: abstained ? [] : answer.sources,
      quotes: abstained ? [] : answer.quotes,
      contextUsed: answer.contextUsed,
      contextBlocks,
      contextError,
      seller: context ? sellerSummary(context.seller!) : null,
      ticket: context ? ticketSummary(context.ticket!) : null,
      trace: context?.trace ?? [],
    }
  } catch (error) {
    if (isSupportError(error)) {
      throw error
    }
    if (isAbortError(error)) {
      throw new SupportError(
        'timeout',
        'Модель не ответила за отведённое время.',
        504,
      )
    }
    throw new SupportError(
      'model_failed',
      'Не удалось получить ответ модели.',
      502,
    )
  }
}
