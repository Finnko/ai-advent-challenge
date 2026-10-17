import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildIndex,
  createRagStore,
  type AnswerLlm,
  type RagIndexStore,
} from '@lib/rag-engine.server'
import type { Embedder } from '@lib/rag-engine.types'
import type { McpSession } from '@lib/mcp/client.server'
import type { ToolArgs } from '@lib/mcp/types'
import { SUPPORT_STRATEGY } from '../domain/constants'
import { SupportError } from '../domain/errors'
import { createOzonCorpus } from '../server/corpus.server'
import { supportChunker } from '../server/chunker.server'
import { askSupport } from '../server/ask.server'
import { createOzonSource } from '../mcp/ozon/source'

const FIXTURES = fileURLToPath(new URL('../data/fixtures', import.meta.url))
const CORPUS = fileURLToPath(
  new URL('../data/fixtures/corpus', import.meta.url),
)
const source = createOzonSource(FIXTURES)

function embedderWith(vector: number[]): Embedder {
  return {
    id: 'test-embedder',
    dim: vector.length,
    async embed(texts) {
      return texts.map(() => Float32Array.from(vector))
    },
  }
}

function fakeSession(
  failures: Record<string, string> = {},
): McpSession & { calls: string[] } {
  const calls: string[] = []
  return {
    name: 'fake-ozon',
    calls,
    async listTools() {
      return { ok: true, tools: [] }
    },
    async call(name: string, args: ToolArgs) {
      calls.push(name)
      const failure = failures[name]
      if (failure) {
        return { ok: false, error: failure }
      }
      if (name === 'get_seller') {
        const seller = await source.seller(String(args.sellerId))
        return seller
          ? { ok: true, text: '', structured: { seller } }
          : { ok: false, error: 'not found' }
      }
      if (name === 'get_ticket') {
        const ticket = await source.ticket(String(args.ticketId))
        return ticket
          ? { ok: true, text: '', structured: { ticket } }
          : { ok: false, error: 'not found' }
      }
      if (name === 'get_finance') {
        const finance = await source.finance(String(args.sellerId))
        return finance
          ? { ok: true, text: '', structured: { finance } }
          : { ok: false, error: 'not found' }
      }
      if (name === 'list_postings') {
        const postings = await source.postingsBySeller(String(args.sellerId))
        return { ok: true, text: '', structured: { postings } }
      }
      if (name === 'get_posting') {
        const posting = await source.posting(String(args.postingNumber))
        return posting
          ? { ok: true, text: '', structured: { posting } }
          : { ok: false, error: 'not found' }
      }
      if (name === 'get_product') {
        const product = await source.product(String(args.productId))
        return product
          ? { ok: true, text: '', structured: { product } }
          : { ok: false, error: 'not found' }
      }
      return { ok: false, error: 'unknown tool' }
    },
    async close() {},
  }
}

const answerLlm: AnswerLlm = async () => ({
  content: JSON.stringify({
    answer:
      '### По документации\n\nПроверьте документы [1].\n\n### По вашему аккаунту и тикету\n\nАккаунт заблокирован.\n\n### Что делать\n\n1. Загрузите документы.',
    quotes: [],
  }),
  usage: null,
  latencyMs: 3,
  model: 'stub',
})

describe('askSupport', () => {
  let dir: string
  let store: RagIndexStore

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'support-ask-'))
    store = await createRagStore(join(dir, 'support.sqlite'))
    await buildIndex({
      strategy: SUPPORT_STRATEGY,
      chunker: supportChunker,
      corpus: createOzonCorpus({ root: CORPUS }),
      embedder: embedderWith([1, 0, 0, 0]),
      store,
    })
  })

  afterAll(async () => {
    store.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('collects MCP context, retrieves docs and answers', async () => {
    const session = fakeSession()
    const result = await askSupport(
      {
        sellerId: 'seller_1042',
        ticketId: 'ticket_502',
        question: 'Почему не приходят заказы и что делать?',
      },
      {
        store,
        session,
        llm: answerLlm,
        embedder: embedderWith([1, 0, 0, 0]),
      },
    )
    expect(result.contextUsed).toBe(true)
    expect(result.abstained).toBe(false)
    expect(result.ticket?.id).toBe('ticket_502')
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.contextBlocks.join('\n')).toContain('posting_1042-1')
    expect(result.contextBlocks.join('\n')).toContain('•••• 7f2a')
    expect(session.calls).toEqual([
      'get_seller',
      'get_ticket',
      'get_finance',
      'list_postings',
      'get_posting',
    ])
  })

  it('ranks the article matching the question keywords first', async () => {
    const result = await askSupport(
      {
        sellerId: 'seller_1042',
        ticketId: 'ticket_502',
        question: 'Почему Ozon блокирует личный кабинет?',
      },
      {
        store,
        session: fakeSession(),
        llm: answerLlm,
        embedder: embedderWith([1, 0, 0, 0]),
        lexicalBoost: 0.03,
      },
    )
    expect(result.sources[0]?.chunk.title).toContain('блокирует')
  })

  it('abstains when retrieval is weak even with ticket context', async () => {
    let calls = 0
    const countingLlm: AnswerLlm = async () => {
      calls += 1
      return answerLlm([], {})
    }
    const result = await askSupport(
      {
        sellerId: 'seller_1042',
        ticketId: 'ticket_501',
        question: 'Какая погода в Москве завтра?',
      },
      {
        store,
        session: fakeSession(),
        llm: countingLlm,
        embedder: embedderWith([0, 1, 0, 0]),
      },
    )
    expect(result.abstained).toBe(true)
    expect(result.answer).toContain('нет ответа')
    expect(calls).toBe(0)
  })

  it('degrades to a docs-only answer when MCP is unavailable', async () => {
    const result = await askSupport(
      {
        sellerId: 'seller_1042',
        ticketId: 'ticket_501',
        question: 'Почему ограничен доступ в кабинет?',
      },
      {
        store,
        llm: answerLlm,
        embedder: embedderWith([1, 0, 0, 0]),
        openSession: async () => ({ ok: false, error: 'MCP down' }),
      },
    )
    expect(result.contextUsed).toBe(false)
    expect(result.contextError).toBe('MCP down')
    expect(result.contextBlocks).toHaveLength(0)
    expect(result.trace).toHaveLength(0)
  })

  it('rejects an unknown ticket', async () => {
    await expect(
      askSupport(
        {
          sellerId: 'seller_1042',
          ticketId: 'ticket_999',
          question: 'Почему не работает вход?',
        },
        {
          store,
          session: fakeSession({ get_ticket: 'not found' }),
          llm: answerLlm,
          embedder: embedderWith([1, 0, 0, 0]),
        },
      ),
    ).rejects.toMatchObject({ code: 'unknown_ticket' })
  })

  it('rejects a ticket of another seller', async () => {
    await expect(
      askSupport(
        {
          sellerId: 'seller_1042',
          ticketId: 'ticket_503',
          question: 'Когда выплата?',
        },
        {
          store,
          session: fakeSession(),
          llm: answerLlm,
          embedder: embedderWith([1, 0, 0, 0]),
        },
      ),
    ).rejects.toMatchObject({ code: 'seller_mismatch' })
  })

  it('reports a missing index', async () => {
    const empty = await createRagStore(join(dir, 'empty.sqlite'))
    try {
      await expect(
        askSupport(
          {
            sellerId: 'seller_1042',
            ticketId: 'ticket_501',
            question: 'Почему не работает вход?',
          },
          { store: empty, session: fakeSession(), llm: answerLlm },
        ),
      ).rejects.toBeInstanceOf(SupportError)
    } finally {
      empty.close()
    }
  })
})
