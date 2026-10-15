import { describe, expect, it } from 'vitest'
import type { AnswerLlm } from '@lib/rag-engine.server'
import type { Chunk, PromptMessage } from '@lib/rag-engine.types'
import type { ReviewFinding } from '../domain/review-report'
import { JUDGE_MAX_TOKENS, judgeFindings } from '../server/review-judge.server'

const CHUNK: Chunk = {
  chunkId: 'code:src/lib/a.ts:review:0',
  strategy: 'review',
  docId: 'code:src/lib/a.ts',
  source: 'src/lib/a.ts',
  title: 'src/lib/a.ts',
  section: 'export function a()',
  sectionPath: ['export function a()'],
  position: 0,
  charStart: 0,
  charEnd: 22,
  nTokens: 4,
  crossesSection: false,
  text: 'export function a() {}',
}

function finding(message: string, overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    severity: 'bug',
    file: 'src/lib/a.ts',
    line: 2,
    message,
    suggestion: 'исправь деление',
    ...overrides,
  }
}

type Captured = {
  messages: PromptMessage[][]
  options: { json?: boolean; maxTokens?: number }[]
}

function makeLlm(reply: (index: number) => string): {
  llm: AnswerLlm
  captured: Captured
} {
  const captured: Captured = { messages: [], options: [] }
  const llm: AnswerLlm = async (messages, options) => {
    const index = captured.messages.length
    captured.messages.push(messages)
    captured.options.push(options ?? {})
    return {
      content: reply(index),
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      latencyMs: 3,
      model: 'judge-model',
    }
  }
  return { llm, captured }
}

describe('judgeFindings', () => {
  it('sends the numbered findings plus the diff and returns only the kept ones', async () => {
    const { llm, captured } = makeLlm(() =>
      JSON.stringify({
        verdicts: [
          { id: 1, keep: true, reason: 'подтверждается диффом' },
          { id: 2, keep: false, reason: 'модуля нет в контексте' },
        ],
      }),
    )

    const result = await judgeFindings({
      findings: [finding('деление на ноль'), finding('модуль дублирует литерал')],
      chunks: [CHUNK],
      contextBlocks: ['### Дифф\n+ const a = 1 / 0'],
      generator: 'cloud',
      llm,
    })

    expect(result.kept.map((entry) => entry.message)).toEqual([
      'деление на ноль',
    ])
    expect(result.dropped).toEqual([
      { finding: expect.objectContaining({ message: 'модуль дублирует литерал' }), reason: 'модуля нет в контексте' },
    ])
    expect(result.filtered).toBe(true)
    expect(result.error).toBeNull()
    expect(result.model).toBe('judge-model')

    const [system, user] = captured.messages[0]
    expect(system.content).toContain('судья-верификатор')
    expect(user.content).toContain('Фрагменты кода и документации проекта')
    expect(user.content).toContain('const a = 1 / 0')
    expect(user.content).toContain('1. [bug] src/lib/a.ts:2 — деление на ноль')
    expect(user.content).toContain('2. [bug] src/lib/a.ts:2 — модуль дублирует литерал')
    expect(captured.options[0]).toEqual({ json: true, maxTokens: JUDGE_MAX_TOKENS })
  })

  it('keeps every finding when the judge answers with prose', async () => {
    const findings = [finding('первая'), finding('вторая')]
    const { llm } = makeLlm(() => 'Извините, не могу проверить.')
    const result = await judgeFindings({
      findings,
      chunks: [],
      generator: 'cloud',
      llm,
    })
    expect(result.kept).toEqual(findings)
    expect(result.filtered).toBe(false)
    expect(result.error).toContain('неразборчивый ответ')
  })

  it('keeps every finding when the judge call fails', async () => {
    const findings = [finding('первая')]
    const llm: AnswerLlm = async () => {
      throw new Error('HTTP 500')
    }
    const result = await judgeFindings({
      findings,
      chunks: [],
      generator: 'cloud',
      llm,
    })
    expect(result.kept).toEqual(findings)
    expect(result.dropped).toEqual([])
    expect(result.filtered).toBe(false)
    expect(result.error).toBe('HTTP 500')
  })

  it('does not call the model when there is nothing to judge', async () => {
    const { llm, captured } = makeLlm(() => '{"verdicts": []}')
    const result = await judgeFindings({
      findings: [],
      chunks: [CHUNK],
      generator: 'cloud',
      llm,
    })
    expect(captured.messages).toHaveLength(0)
    expect(result.kept).toEqual([])
    expect(result.filtered).toBe(false)
    expect(result.error).toBeNull()
  })
})
