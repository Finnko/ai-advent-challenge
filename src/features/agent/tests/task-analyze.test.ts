import { describe, expect, it } from 'vitest'
import type { CallLLM, LlmMessage } from '../domain/agent'
import {
  buildTaskStateMessages,
  createAnalyzeTaskState,
  parseTaskAnalysis,
} from '../domain/task/analyze'
import type { TaskState } from '../domain/task/types'

const CURRENT: TaskState = {
  title: 'Забронировать переговорку',
  stage: 'paused',
  previousStage: 'planning',
  step: 'Собираем параметры',
  expectedAction: { actor: 'user', description: 'Назвать число участников' },
  updatedAt: '2026-09-10T12:00:00.000Z',
  history: [],
}

describe('parseTaskAnalysis', () => {
  it('разбирает валидный ответ', () => {
    const parsed = parseTaskAnalysis(
      JSON.stringify({
        title: 'Отчёт',
        stage: 'execution',
        step: 'Собираем данные',
        expectedAction: { actor: 'agent', description: 'Вызвать инструмент' },
        reason: 'Приступаем',
      }),
    )
    expect(parsed).toMatchObject({
      title: 'Отчёт',
      stage: 'execution',
      step: 'Собираем данные',
      reason: 'Приступаем',
    })
    expect(parsed?.expectedAction).toEqual({
      actor: 'agent',
      description: 'Вызвать инструмент',
    })
  })

  it('снимает markdown-обёртку', () => {
    const parsed = parseTaskAnalysis(
      '```json\n{"stage":"planning","step":"x","expectedAction":{"actor":"user","description":"y"}}\n```',
    )
    expect(parsed?.stage).toBe('planning')
  })

  it('возвращает null для неизвестной стадии и битого JSON', () => {
    expect(parseTaskAnalysis('{"stage":"flying"}')).toBeNull()
    expect(parseTaskAnalysis('не json')).toBeNull()
    expect(parseTaskAnalysis('[]')).toBeNull()
  })

  it('дефолтит актора, если он некорректен', () => {
    const parsed = parseTaskAnalysis(
      '{"stage":"execution","step":"x","expectedAction":{"actor":"robot","description":"y"}}',
    )
    expect(parsed?.expectedAction.actor).toBe('agent')
  })
})

describe('buildTaskStateMessages', () => {
  it('включает текущее состояние, историю и ход пользователя', () => {
    const messages = buildTaskStateMessages({
      current: CURRENT,
      history: [
        { role: 'user', content: 'нужна переговорка' },
        { role: 'assistant', content: 'уточните время' },
      ],
      userMessage: 'продолжим',
    })
    const system = messages.find((message) => message.role === 'system')
    const user = messages.find((message) => message.role === 'user')
    expect(system?.content).toContain('конечный автомат')
    expect(user?.content).toContain('"stage": "paused"')
    expect(user?.content).toContain('assistant: уточните время')
    expect(user?.content).toContain('продолжим')
  })
})

describe('createAnalyzeTaskState', () => {
  it('зовёт LLM в json-режиме и возвращает разбор с usage', async () => {
    const captured: Array<Parameters<CallLLM>[0]> = []
    const callLLM: CallLLM = async (params) => {
      captured.push(params)
      return {
        content:
          '{"stage":"execution","step":"Бронируем","expectedAction":{"actor":"agent","description":"bookMeetingRoom"}}',
        usage: { prompt_tokens: 5, completion_tokens: 3 },
        latencyMs: 10,
      }
    }
    const analyze = createAnalyzeTaskState(callLLM)
    const result = await analyze({
      current: CURRENT,
      history: [],
      userMessage: 'продолжим',
    })
    expect(result.analysis?.stage).toBe('execution')
    expect(result.usage).toEqual({ prompt_tokens: 5, completion_tokens: 3 })
    expect(captured[0].response_format).toEqual({ type: 'json_object' })
    const systemContents: LlmMessage[] = captured[0].messages
    expect(systemContents[0].role).toBe('system')
  })
})
