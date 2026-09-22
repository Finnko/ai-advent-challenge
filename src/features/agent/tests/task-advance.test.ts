import { describe, expect, it } from 'vitest'
import type { AgentRunResult, AgentTraceStep } from '../domain/agent'
import {
  advanceAfterRun,
  advanceStep,
  advanceToExecution,
  hasReadonlyVerification,
  hasSuccessfulMutation,
  looksLikeApproval,
  looksLikeCancel,
  looksLikeCorrection,
} from '../domain/task/advance'
import type { TaskState } from '../domain/task/types'
import { TEST_NOW } from './agent-testkit'

function taskState(overrides: Partial<TaskState> = {}): TaskState {
  return {
    title: 'Задача',
    stage: 'execution',
    previousStage: null,
    approved: false,
    step: 'шаг',
    steps: [],
    stepIndex: 0,
    expectedAction: { actor: 'agent', description: 'действие' },
    updatedAt: TEST_NOW.toISOString(),
    history: [],
    ...overrides,
  }
}

function act(
  tool: string,
  ok = true,
): Extract<AgentTraceStep, { stage: 'act' }> {
  return {
    stage: 'act',
    tool,
    args: {},
    outcome: { ok, text: `${tool} выполнен`, reference: ok ? 'BOOK-X' : null },
  }
}

function run(
  trace: AgentTraceStep[],
  blocked = false,
): Pick<AgentRunResult, 'trace' | 'blocked'> {
  return { trace, blocked }
}

describe('классификация хода', () => {
  it('находит успешное изменяющее действие', () => {
    expect(hasSuccessfulMutation(run([act('bookMeetingRoom')]))).toBe(true)
    expect(hasSuccessfulMutation(run([act('bookMeetingRoom', false)]))).toBe(
      false,
    )
    expect(hasSuccessfulMutation(run([act('listBookings')]))).toBe(false)
  })

  it('находит успешную справочную проверку', () => {
    expect(hasReadonlyVerification(run([act('listBookings')]))).toBe(true)
    expect(hasReadonlyVerification(run([]))).toBe(false)
    expect(hasReadonlyVerification(run([act('bookMeetingRoom')]))).toBe(false)
  })

  it('распознаёт правку по тексту', () => {
    expect(looksLikeCorrection('Ты сделал неверно, переделай')).toBe(true)
    expect(looksLikeCorrection('исправь комнату')).toBe(true)
    expect(looksLikeCorrection('не торопись')).toBe(false)
    expect(looksLikeCorrection('всё верно, спасибо')).toBe(false)
  })

  it('распознаёт отмену только по явным фразам', () => {
    expect(looksLikeCancel('Задача отменена')).toBe(true)
    expect(looksLikeCancel('пожалуйста,   отмени задачу')).toBe(true)
    expect(looksLikeCancel('отмена задачи')).toBe(true)
    expect(looksLikeCancel('нет, продолжай')).toBe(false)
    expect(looksLikeCancel('отмени встречу')).toBe(false)
  })

  it('распознаёт явное согласие на план', () => {
    for (const text of [
      'да',
      'Да, приступай',
      'окей делаем',
      'поехали',
      'всё верно',
      'подтверждаю',
      'начинай',
    ]) {
      expect(looksLikeApproval(text)).toBe(true)
    }
  })

  it('не считает согласием посторонние слова и вопросы', () => {
    for (const text of [
      'дальше',
      'окно',
      'около',
      'не надо',
      'а что если',
      'покажи план',
    ]) {
      expect(looksLikeApproval(text)).toBe(false)
    }
  })

  it('не считает согласием настойчивые просьбы пропустить план', () => {
    for (const text of [
      'нет давай пропусти бронируем',
      'давай забронируй',
      'го сразу',
    ]) {
      expect(looksLikeApproval(text)).toBe(false)
    }
  })

  it('распознаёт согласие с опечаткой в одну правку', () => {
    for (const text of [
      'подтвреждаю',
      'подтвердаю',
      'согласн',
      'приступаю',
    ]) {
      expect(looksLikeApproval(text)).toBe(true)
    }
  })

  it('не считает согласием похожие слова и короткие токены', () => {
    for (const text of [
      'дальше',
      'давай',
      'окно',
      'около',
      'покажи',
      'не надо',
      'а что если',
    ]) {
      expect(looksLikeApproval(text)).toBe(false)
    }
  })

  it('коррекция перебивает согласие', () => {
    expect(looksLikeApproval('да, но ты сделал неверно, переделай')).toBe(false)
    expect(looksLikeApproval('не верно, исправь')).toBe(false)
  })
})

describe('advanceAfterRun', () => {
  it('переводит execution → validation после успешного действия', () => {
    const result = advanceAfterRun(
      taskState({ stage: 'execution' }),
      run([act('bookMeetingRoom')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('validation')
    expect(result?.event).toMatchObject({
      kind: 'transition',
      from: 'execution',
      to: 'validation',
    })
    expect(result?.state.history).toHaveLength(1)
  })

  it('не двигает execution на читающем ходе без плана', () => {
    expect(
      advanceAfterRun(
        taskState({ stage: 'execution' }),
        run([act('listBookings')]),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })

  it('двигает план на читающем шаге execution', () => {
    const result = advanceAfterRun(
      taskState({
        stage: 'execution',
        steps: ['Проверить участников', 'Пригласить'],
        stepIndex: 0,
        step: 'Проверить участников',
      }),
      run([act('listBookings')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('execution')
    expect(result?.state.stepIndex).toBe(1)
    expect(result?.event).toMatchObject({
      kind: 'step',
      to: 'Пригласить',
    })
  })

  it('переводит execution → validation, когда читающий шаг последний', () => {
    const result = advanceAfterRun(
      taskState({
        stage: 'execution',
        steps: ['Проверить участников'],
        stepIndex: 0,
        step: 'Проверить участников',
      }),
      run([act('listBookings')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('validation')
  })

  it('переводит validation → done после успешной проверки', () => {
    const result = advanceAfterRun(
      taskState({ stage: 'validation' }),
      run([act('listBookings')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('done')
  })

  it('не завершает validation без реальной проверки', () => {
    expect(
      advanceAfterRun(
        taskState({ stage: 'validation' }),
        run([]),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })

  it('не завершает validation при правке пользователя', () => {
    expect(
      advanceAfterRun(
        taskState({ stage: 'validation' }),
        run([act('listBookings')]),
        TEST_NOW.toISOString(),
        'результат неверный, переделай',
      ),
    ).toBeNull()
  })

  it('не завершает задачу, если на validation прошла мутация', () => {
    expect(
      advanceAfterRun(
        taskState({ stage: 'validation' }),
        run([act('bookMeetingRoom')]),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })

  it('не двигает паузу и заблокированный ход', () => {
    expect(
      advanceAfterRun(
        taskState({ stage: 'paused' }),
        run([act('bookMeetingRoom')]),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
    expect(
      advanceAfterRun(
        taskState({ stage: 'execution' }),
        run([act('bookMeetingRoom')], true),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })
})

describe('advanceStep', () => {
  it('двигает ровно на один шаг', () => {
    const result = advanceStep(
      taskState({
        stage: 'execution',
        steps: ['a', 'b', 'c'],
        stepIndex: 0,
        step: 'a',
      }),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stepIndex).toBe(1)
    expect(result?.state.step).toBe('b')
    expect(result?.event).toMatchObject({
      kind: 'step',
      from: 'a',
      to: 'b',
      index: 1,
    })
  })

  it('возвращает null на последнем шаге', () => {
    expect(
      advanceStep(
        taskState({ steps: ['a'], stepIndex: 0, step: 'a' }),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })
})

describe('advanceAfterRun с планом', () => {
  it('после действия двигает шаг', () => {
    const result = advanceAfterRun(
      taskState({ steps: ['a', 'b'], stepIndex: 0, step: 'a' }),
      run([act('bookMeetingRoom')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('execution')
    expect(result?.state.stepIndex).toBe(1)
    expect(result?.event).toMatchObject({ kind: 'step', to: 'b' })
  })

  it('на последнем шаге переводит execution → validation', () => {
    const result = advanceAfterRun(
      taskState({ steps: ['a'], stepIndex: 0, step: 'a' }),
      run([act('bookMeetingRoom')]),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('validation')
    expect(result?.state.steps).toEqual(['Сверить результат'])
    expect(result?.state.stepIndex).toBe(0)
  })
})

describe('advanceToExecution', () => {
  it('возвращает validation → execution', () => {
    const result = advanceToExecution(
      taskState({ stage: 'validation' }),
      TEST_NOW.toISOString(),
    )
    expect(result?.state.stage).toBe('execution')
    expect(result?.event).toMatchObject({
      kind: 'transition',
      from: 'validation',
      to: 'execution',
    })
  })

  it('не двигает завершённую задачу', () => {
    expect(
      advanceToExecution(
        taskState({ stage: 'done' }),
        TEST_NOW.toISOString(),
      ),
    ).toBeNull()
  })
})
