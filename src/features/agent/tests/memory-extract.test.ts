import { describe, expect, it } from 'vitest'
import type { CallLLM } from '../domain/agent'
import {
  buildMemoryMessages,
  createExtractMemories,
  parseMemoryCandidates,
} from '../domain/memory/extract'
import type { MemorySnapshot } from '../domain/memory/types'

const emptySnapshot: MemorySnapshot = { working: [], longTerm: [] }

describe('parseMemoryCandidates', () => {
  it('читает объект {memories:[...]}', () => {
    const parsed = parseMemoryCandidates(
      '{"memories":[{"layer":"working","key":"Цель","value":"запуск"}]}',
    )
    expect(parsed).toEqual([{ layer: 'working', key: 'Цель', value: 'запуск' }])
  })

  it('читает верхнеуровневый массив и снимает code fence', () => {
    const parsed = parseMemoryCandidates(
      '```json\n[{"key":"Роль","value":"кофе"}]\n```',
    )
    expect(parsed).toEqual([{ layer: null, key: 'Роль', value: 'кофе' }])
  })

  it('обнуляет неизвестный слой, чтобы роутер разметил сам', () => {
    const parsed = parseMemoryCandidates(
      '{"memories":[{"layer":"episodic","key":"k","value":"v"}]}',
    )
    expect(parsed[0].layer).toBeNull()
  })

  it('устойчив к мусору', () => {
    expect(parseMemoryCandidates('не json')).toEqual([])
    expect(parseMemoryCandidates('{"memories":"nope"}')).toEqual([])
    expect(
      parseMemoryCandidates('{"memories":[{"key":"","value":"x"}]}'),
    ).toEqual([])
  })
})

describe('createExtractMemories', () => {
  it('возвращает кандидатов и usage из ответа модели', async () => {
    const callLLM: CallLLM = async () => ({
      content:
        '{"memories":[{"layer":"long-term","key":"Предпочтение","value":"коротко"}]}',
      usage: { prompt_tokens: 12, completion_tokens: 5 },
      latencyMs: 3,
    })
    const extract = createExtractMemories(callLLM)
    const result = await extract(emptySnapshot, 'мне нравятся короткие отчёты')

    expect(result.candidates).toEqual([
      { layer: 'long-term', key: 'Предпочтение', value: 'коротко' },
    ])
    expect(result.usage).toEqual({ prompt_tokens: 12, completion_tokens: 5 })
  })

  it('включает известную память и сообщение в промпт', () => {
    const messages = buildMemoryMessages(
      {
        working: [
          {
            layer: 'working',
            key: 'Цель',
            value: 'запуск',
            source: 'auto',
            updatedAt: 'now',
          },
        ],
        longTerm: [],
      },
      'новое сообщение',
    )
    const joined = messages.map((m) => m.content).join('\n')
    expect(joined).toContain('Цель')
    expect(joined).toContain('новое сообщение')
    expect(joined).toContain('long-term')
  })
})
