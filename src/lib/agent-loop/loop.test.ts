import { describe, expect, it } from 'vitest'
import {
  formatToolReport,
  parseDecideJson,
  resolveArgRefs,
  runToolLoop,
} from './loop'
import type {
  CallLLM,
  LlmParams,
  LoopConfig,
  LoopHooks,
  Tool,
  ToolArgs,
} from './types'

function decide(tool: string | null, args: Record<string, unknown> = {}) {
  return JSON.stringify({ tool, args })
}

function scriptedLlm(decides: string[], finalize = 'Готово.') {
  const calls: LlmParams[] = []
  let index = 0
  const callLLM: CallLLM = async (params) => {
    calls.push(params)
    if (!params.response_format) {
      return {
        content: finalize,
        usage: { prompt_tokens: 5, completion_tokens: 2 },
        latencyMs: 1,
      }
    }
    const content = decides[Math.min(index, decides.length - 1)] ?? decide(null)
    index += 1
    return {
      content,
      usage: { prompt_tokens: 10, completion_tokens: 3 },
      latencyMs: 2,
    }
  }
  return { callLLM, calls }
}

type FakeTool = Tool<undefined> & { seen: ToolArgs[] }

function fakeTool(
  name: string,
  result:
    | { text: string; refText?: string; ok?: boolean }
    | ((args: ToolArgs) => { text: string; refText?: string; ok?: boolean }),
  mutating = false,
): FakeTool {
  const seen: ToolArgs[] = []
  return {
    name,
    description: name,
    argsExample: '{}',
    mutating,
    seen,
    run: (args) => {
      seen.push(args)
      const value = typeof result === 'function' ? result(args) : result
      return {
        ok: value.ok ?? true,
        text: value.text,
        reference: null,
        refText: value.refText,
      }
    },
  }
}

function baseHooks(
  overrides: Partial<LoopHooks<undefined>> = {},
): LoopHooks<undefined> {
  return {
    ...overrides,
    prompts: {
      systemMessages: () => [{ role: 'system', content: 'sys' }],
      decideUser: () => 'Запрос: шаг',
      finalizeUser: (_state, report) => `Отчёт:\n${report}`,
      ...overrides.prompts,
    },
  }
}

function baseConfig(
  overrides: Partial<LoopConfig<undefined>> = {},
): LoopConfig<undefined> {
  const { callLLM } = scriptedLlm([decide(null)])
  return {
    request: 'Сделай шаг',
    model: 'test-model',
    callLLM,
    toolContext: undefined,
    tools: [],
    allowedToolNames: [],
    history: [],
    systemTokens: 10,
    contextTokens: 0,
    contextMessages: 0,
    hooks: baseHooks(),
    ...overrides,
  }
}

describe('parseDecideJson', () => {
  it('достаёт json из markdown-обёртки и мусора', () => {
    expect(
      parseDecideJson('```json\n{"tool":"a","args":{"x":1}}\n```'),
    ).toEqual({
      tool: 'a',
      args: { x: 1 },
    })
    expect(parseDecideJson('ответ: {"tool":null,"args":{}} — всё')).toEqual({
      tool: null,
      args: {},
    })
  })

  it('деградирует в «без инструмента» на невалидном json', () => {
    expect(parseDecideJson('{ не json')).toEqual({ tool: null, args: {} })
  })
})

describe('resolveArgRefs', () => {
  const outputs = [
    { id: 1, tool: 'read', text: 'первый' },
    { id: 2, tool: 'read', text: 'обрезан…', refText: 'полный текст' },
  ]

  it('подставляет текст и полный refText', () => {
    expect(resolveArgRefs({ content: { $ref: '1' } }, outputs)).toEqual({
      ok: true,
      args: { content: 'первый' },
    })
    expect(resolveArgRefs({ content: { $ref: 'last' } }, outputs)).toEqual({
      ok: true,
      args: { content: 'полный текст' },
    })
  })

  it('склеивает несколько ссылок', () => {
    const result = resolveArgRefs({ text: { $ref: ['1', '2'] } }, outputs)
    expect(result).toEqual({
      ok: true,
      args: { text: 'первый\n\nполный текст' },
    })
  })

  it('возвращает ошибку на потерянную ссылку', () => {
    const result = resolveArgRefs({ content: { $ref: '9' } }, outputs)
    expect(result.ok).toBe(false)
  })

  it('не трогает обычные значения', () => {
    expect(resolveArgRefs({ path: 'a.ts', n: 2 }, outputs)).toEqual({
      ok: true,
      args: { path: 'a.ts', n: 2 },
    })
  })
})

describe('runToolLoop — цепочка инструментов', () => {
  it('передаёт вывод инструмента по ссылке вместо копирования', async () => {
    const read = fakeTool('read_file', { text: 'СОДЕРЖИМОЕ' })
    const write = fakeTool('write_file', { text: 'записано' }, true)
    const { callLLM } = scriptedLlm([
      decide('read_file', { path: 'a.ts' }),
      decide('write_file', { content: { $ref: '1' } }),
      decide(null),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read, write],
        allowedToolNames: ['read_file', 'write_file'],
        hooks: baseHooks(),
      }),
    )

    expect(write.seen).toEqual([{ content: 'СОДЕРЖИМОЕ' }])
    expect(result.ok).toBe(true)
    expect(result.answer).toBe('Готово.')
    expect(result.trace.map((step) => step.stage)).toEqual([
      'input',
      'decide',
      'act',
      'decide',
      'act',
      'decide',
      'finalize',
      'verdicts',
    ])
    expect(result.tokens.promptTokensActual).toBe(35)
    expect(result.tokens.responseTokens).toBe(2 + 9)
  })

  it('останавливается после первой неуспешной ссылки и отдаёт отказ', async () => {
    const write = fakeTool('write_file', { text: 'записано' }, true)
    const { callLLM } = scriptedLlm([
      decide('write_file', { content: { $ref: '9' } }),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [write],
        allowedToolNames: ['write_file'],
      }),
    )

    expect(write.seen).toEqual([])
    expect(result.blocked).toBe(false)
    expect(result.answer).toContain('Ссылка $ref "9" не найдена')
  })

  it('не повторяет ту же пару инструмент+аргументы', async () => {
    const read = fakeTool('read_file', { text: 'x' })
    const { callLLM } = scriptedLlm([
      decide('read_file', { path: 'a.ts' }),
      decide('read_file', { path: 'a.ts' }),
      decide(null),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read],
        allowedToolNames: ['read_file'],
      }),
    )

    expect(read.seen).toHaveLength(1)
    expect(result.trace.filter((step) => step.stage === 'act')).toHaveLength(1)
  })

  it('уважает maxActions', async () => {
    const read = fakeTool('read_file', (args) => ({
      text: `файл ${String(args.path)}`,
    }))
    const { callLLM } = scriptedLlm([
      decide('read_file', { path: 'a.ts' }),
      decide('read_file', { path: 'b.ts' }),
      decide('read_file', { path: 'c.ts' }),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read],
        allowedToolNames: ['read_file'],
        maxActions: 2,
      }),
    )

    expect(read.seen).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
    expect(result.answer).toBe('Готово.')
  })
})

describe('runToolLoop — политика', () => {
  it('спрашивает nudge один раз, если первый decide пуст', async () => {
    const read = fakeTool('read_file', { text: 'x' })
    const { callLLM, calls } = scriptedLlm([
      decide(null),
      decide('read_file', { path: 'a.ts' }),
      decide(null),
    ])
    let nudges = 0
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read],
        allowedToolNames: ['read_file'],
        hooks: baseHooks({
          policy: {
            nudge: () => {
              nudges += 1
              return 'Возьми инструмент.'
            },
          },
        }),
      }),
    )

    expect(nudges).toBe(1)
    expect(read.seen).toHaveLength(1)
    expect(calls.filter((call) => call.response_format).length).toBe(3)
    expect(result.ok).toBe(true)
  })

  it('даёт сменить вызов при повторе, если объявлен onRepeat', async () => {
    const read = fakeTool('read_file', { text: 'x' })
    const write = fakeTool('write_file', { text: 'записано' }, true)
    const { callLLM } = scriptedLlm([
      decide('read_file', { path: 'a.ts' }),
      decide('read_file', { path: 'a.ts' }),
      decide('write_file', { path: 'a.ts' }),
      decide(null),
    ])
    let repeats = 0
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read, write],
        allowedToolNames: ['read_file', 'write_file'],
        hooks: baseHooks({
          policy: {
            onRepeat: () => {
              repeats += 1
              return 'Смени вызов.'
            },
          },
        }),
      }),
    )

    expect(repeats).toBe(1)
    expect(read.seen).toHaveLength(1)
    expect(write.seen).toHaveLength(1)
    expect(result.ok).toBe(true)
  })

  it('рвёт повторы без onRepeat', async () => {
    const read = fakeTool('read_file', { text: 'x' })
    const { callLLM } = scriptedLlm([
      decide('read_file', { path: 'a.ts' }),
      decide('read_file', { path: 'a.ts' }),
      decide(null),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [read],
        allowedToolNames: ['read_file'],
      }),
    )

    expect(read.seen).toHaveLength(1)
    expect(result.ok).toBe(true)
  })

  it('отклоняет вызов закрытым гейтом и объясняет отказ', async () => {
    const write = fakeTool('write_file', { text: 'записано' }, true)
    const { callLLM } = scriptedLlm([
      decide('write_file', { path: 'a.ts' }),
      decide('write_file', { path: 'a.ts' }),
    ])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [write],
        allowedToolNames: ['write_file'],
        hooks: baseHooks({
          policy: {
            gate: () => ({
              allow: false,
              reason: 'Этап проверки: только чтение.',
            }),
          },
        }),
      }),
    )

    expect(write.seen).toEqual([])
    expect(result.answer).toContain('Этап проверки: только чтение.')
    expect(result.trace[2]).toMatchObject({
      stage: 'act',
      outcome: { ok: false },
    })
  })

  it('блокирует ответ при срабатывании инварианта и зовёт onBlocked', async () => {
    const { callLLM } = scriptedLlm([decide(null)], 'Запрещённый ответ')
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        hooks: baseHooks({
          policy: {
            checkAnswer: () => ({
              ok: false,
              hits: ['INV-7'],
              reason: 'Ответ нарушает правило 7.',
            }),
            onBlocked: (_state, info) => ({
              answer: `Стоп: ${info.answerCheck.reason}`,
              reason: info.answerCheck.reason,
            }),
          },
        }),
      }),
    )

    expect(result.blocked).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.invariantHits).toEqual(['INV-7'])
    expect(result.answer).toBe('Стоп: Ответ нарушает правило 7.')
  })

  it('сохраняет попадание инварианта из действия', async () => {
    const write = fakeTool('write_file', { text: 'записано' }, true)
    const { callLLM } = scriptedLlm([decide('write_file', { path: 'a.ts' })])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        tools: [write],
        allowedToolNames: ['write_file'],
        hooks: baseHooks({
          policy: {
            checkAction: () => ({
              ok: false,
              hits: ['INV-1'],
              reason: 'Путь вне плана.',
            }),
          },
        }),
      }),
    )

    expect(write.seen).toEqual([])
    expect(result.blocked).toBe(true)
    expect(result.invariantHits).toEqual(['INV-1'])
    expect(result.trace[2]).toMatchObject({
      stage: 'act',
      invariantHits: ['INV-1'],
    })
  })

  it('пропускает ответ, если guard упал (fail-open)', async () => {
    const { callLLM } = scriptedLlm([decide(null)], 'Ответ')
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        hooks: baseHooks({
          policy: {
            guard: () => Promise.reject(new Error('LLM недоступна')),
          },
        }),
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.answer).toBe('Ответ')
    const guardStep = result.trace.find(
      (step) => step.stage === 'invariant-guard',
    )
    expect(guardStep).toMatchObject({
      verdict: { status: 'pass' },
      error: 'LLM недоступна',
    })
  })

  it('не зовёт finalize, если задача встала на паузу до действий', async () => {
    const { callLLM } = scriptedLlm([decide(null)], 'Готово.')
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        hooks: baseHooks({ isPaused: () => true }),
      }),
    )

    expect(result.answer).toBe('')
    expect(result.ok).toBe(true)
    expect(result.trace.some((step) => step.stage === 'finalize')).toBe(false)
  })
})

describe('runToolLoop — входные и контекстные границы', () => {
  it('отклоняет пустой запрос', async () => {
    const result = await runToolLoop(baseConfig({ request: '   ' }))
    expect(result.ok).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.answer).toContain('input policy')
  })

  it('отклоняет запрос длиннее лимита', async () => {
    const result = await runToolLoop(
      baseConfig({ request: 'а'.repeat(20), maxInputChars: 10 }),
    )
    expect(result.trace[0]).toEqual({
      stage: 'input',
      accepted: false,
      charCount: 20,
    })
    expect(result.answer).toContain('длиннее 10 символов')
  })

  it('отклоняет запрос, не влезающий в контекстный бюджет', async () => {
    const result = await runToolLoop(
      baseConfig({ request: 'привет', systemTokens: 100, budgetTokens: 50 }),
    )
    expect(result.blocked).toBe(true)
    expect(result.answer).toContain('контекстной политикой')
  })

  it('считает стоимость через hook cost', async () => {
    const { callLLM } = scriptedLlm([decide(null)])
    const result = await runToolLoop(
      baseConfig({
        callLLM,
        hooks: baseHooks({
          cost: (usage) => (usage?.prompt_tokens ?? 0) / 1000,
        }),
      }),
    )
    expect(result.tokens.costUsd).toBeCloseTo(0.01)
  })
})

describe('formatToolReport', () => {
  it('печатает код подтверждения и пустой отчёт', () => {
    expect(formatToolReport([])).toBe('(инструменты не вызывались)')
    const report = formatToolReport([
      {
        tool: 'book',
        args: {},
        outcome: { ok: true, text: 'готово', reference: 'REF-1' },
      },
    ])
    expect(report).toContain('ОТЧЁТ ИНСТРУМЕНТА (book)')
    expect(report).toContain('Код подтверждения: REF-1')
  })
})
