import { describe, expect, it } from 'vitest'
import type { InvariantRecord } from '../domain/invariants/types'
import type { CallLLM } from '../domain/agent'
import { createInvariantGuard, hasChecklessInvariant } from '../domain/invariants/guard'

const records: InvariantRecord[] = [
  { id: 9, token: 'test', slug: 'custom', category: 'business', title: 'Без сахара', text: 'Не предлагай сахар.', check: null, pinned: false },
  { id: 10, token: 'test', slug: 'checked', category: 'stack', title: 'SQLite', text: 'Только SQLite.', check: 'sqlite-only', pinned: true },
]

function input(content: string): CallLLM {
  return async () => ({
    content,
    usage: { prompt_tokens: 4, completion_tokens: 3 },
    latencyMs: 7,
  })
}

describe('invariant guard', () => {
  it('runs only for checkless rules and keeps valid hits', async () => {
    expect(hasChecklessInvariant(records)).toBe(true)
    const verdict = await createInvariantGuard(input('```json\n{"status":"fail","hits":["INV-9","INV-404"],"reason":"Нарушено"}\n```'))({
      request: 'запрос',
      answer: 'ответ',
      report: 'отчёт',
      invariants: records,
    })
    expect(verdict.status).toBe('fail')
    expect(verdict.hits).toEqual(['INV-9'])
    expect(verdict.usage?.prompt_tokens).toBe(4)
  })

  it('fails open for malformed output or only unknown codes', async () => {
    const malformed = await createInvariantGuard(input('not json'))({ request: 'x', answer: 'y', report: '', invariants: records })
    expect(malformed.status).toBe('pass')
    const unknown = await createInvariantGuard(input('{"status":"fail","hits":["INV-404"],"reason":"x"}'))({ request: 'x', answer: 'y', report: '', invariants: records })
    expect(unknown.status).toBe('pass')
    expect(unknown.hits).toEqual([])
  })
})
