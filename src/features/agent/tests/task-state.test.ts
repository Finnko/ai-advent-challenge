import { describe, expect, it } from 'vitest'
import {
  applyAnalysis,
  cancelTask,
  canTransition,
  createTaskState,
  pauseTask,
  resumeTask,
  transitionTask,
} from '../domain/task/state'
import type { TaskAnalysis } from '../domain/task/state'
import type { TaskStage, TaskState } from '../domain/task/types'
import { TASK_HISTORY_LIMIT } from '../domain/task/types'

const AT = '2026-09-10T12:00:00.000Z'

function analysis(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    stage: 'execution',
    step: 'Бронируем комнату',
    expectedAction: { actor: 'agent', description: 'Вызвать bookMeetingRoom' },
    ...overrides,
  }
}

function state(stage: TaskStage, overrides: Partial<TaskState> = {}): TaskState {
  return {
    title: 'Задача',
    stage,
    previousStage: null,
    step: 'шаг',
    steps: [],
    stepIndex: 0,
    expectedAction: { actor: 'agent', description: 'действие' },
    updatedAt: AT,
    history: [],
    ...overrides,
  }
}

describe('task state machine', () => {
  it('создаёт задачу из анализа', () => {
    const created = createTaskState(
      analysis({ title: 'Отчёт', stage: 'planning' }),
      AT,
    )
    expect(created.title).toBe('Отчёт')
    expect(created.stage).toBe('planning')
    expect(created.previousStage).toBeNull()
    expect(created.history).toEqual([])
    expect(created.expectedAction.actor).toBe('agent')
  })

  it('создаёт план шагов из анализа', () => {
    const created = createTaskState(
      analysis({
        stage: 'planning',
        step: 'Уточнить дату',
        steps: ['Уточнить дату', 'Выбрать комнату', 'Забронировать'],
      }),
      AT,
    )
    expect(created.steps).toEqual([
      'Уточнить дату',
      'Выбрать комнату',
      'Забронировать',
    ])
    expect(created.stepIndex).toBe(0)
    expect(created.step).toBe('Уточнить дату')
  })

  it('при смене этапа пересобирает план и сбрасывает индекс', () => {
    const prev = state('planning', {
      steps: ['a', 'b'],
      stepIndex: 1,
      step: 'b',
    })
    const { state: next } = applyAnalysis(
      prev,
      analysis({
        stage: 'execution',
        step: 'Забронировать',
        steps: ['Забронировать', 'Пригласить'],
      }),
      AT,
    )
    expect(next.steps).toEqual(['Забронировать', 'Пригласить'])
    expect(next.stepIndex).toBe(0)
    expect(next.step).toBe('Забронировать')
  })

  it('на том же этапе не перескакивает шаг по анализатору', () => {
    const prev = state('execution', {
      steps: ['Первый', 'Второй'],
      stepIndex: 0,
      step: 'Первый',
    })
    const { state: next } = applyAnalysis(
      prev,
      analysis({ stage: 'execution', step: 'Второй' }),
      AT,
    )
    expect(next.stepIndex).toBe(0)
    expect(next.step).toBe('Первый')
  })

  it('ограничивает индекс при сокращении плана', () => {
    const prev = state('execution', {
      steps: ['a', 'b', 'c'],
      stepIndex: 2,
      step: 'c',
    })
    const { state: next } = applyAnalysis(
      prev,
      analysis({ stage: 'execution', steps: ['a', 'b'] }),
      AT,
    )
    expect(next.stepIndex).toBe(1)
    expect(next.step).toBe('b')
  })

  it('разрешает только валидные переходы графа', () => {
    expect(canTransition('planning', 'execution')).toBe(true)
    expect(canTransition('execution', 'validation')).toBe(true)
    expect(canTransition('validation', 'done')).toBe(true)
    expect(canTransition('done', 'planning')).toBe(true)
    expect(canTransition('planning', 'done')).toBe(false)
    expect(canTransition('planning', 'validation')).toBe(false)
  })

  it('применяет допустимый переход и пишет историю', () => {
    const { state: next, rejection } = applyAnalysis(
      state('planning'),
      analysis({ stage: 'execution', reason: 'Приступаем' }),
      AT,
    )
    expect(rejection).toBeNull()
    expect(next.stage).toBe('execution')
    expect(next.step).toBe('Бронируем комнату')
    expect(next.history).toHaveLength(1)
    expect(next.history[0]).toMatchObject({
      from: 'planning',
      to: 'execution',
      reason: 'Приступаем',
    })
  })

  it('первая задача всегда создаётся в planning', () => {
    expect(
      createTaskState(analysis({ stage: 'execution' }), AT).stage,
    ).toBe('planning')
    expect(createTaskState(analysis({ stage: 'done' }), AT).stage).toBe(
      'planning',
    )
  })

  it('отклоняет нелегальный переход, полностью сохраняя прежнее состояние', () => {
    const prev = state('planning')
    const { state: next, rejection } = applyAnalysis(
      prev,
      analysis({ stage: 'done', step: 'Готово' }),
      AT,
    )
    expect(next).toBe(prev)
    expect(rejection).toEqual({
      from: 'planning',
      to: 'done',
      reason: 'Обновление состояния',
    })
    expect(next.stage).toBe('planning')
    expect(next.step).toBe('шаг')
    expect(next.updatedAt).toBe(AT)
    expect(next.history).toEqual([])
  })

  it('ставит на паузу с любой активной стадии и запоминает этап', () => {
    for (const stage of ['planning', 'execution', 'validation'] as TaskStage[]) {
      const paused = pauseTask(state(stage), AT)
      expect(paused.stage).toBe('paused')
      expect(paused.previousStage).toBe(stage)
      expect(paused.history.at(-1)).toMatchObject({ from: stage, to: 'paused' })
    }
  })

  it('не ставит на паузу повторно и не трогает терминальные состояния', () => {
    const paused = state('paused', { previousStage: 'planning' })
    expect(pauseTask(paused, AT)).toBe(paused)
    const done = state('done')
    expect(pauseTask(done, AT)).toBe(done)
  })

  it('продолжает с прежнего этапа и очищает previousStage', () => {
    const paused = pauseTask(state('execution'), AT)
    const resumed = resumeTask(paused, AT)
    expect(resumed.stage).toBe('execution')
    expect(resumed.previousStage).toBeNull()
    expect(resumed.history.at(-1)).toMatchObject({
      from: 'paused',
      to: 'execution',
    })
  })

  it('fallback продолжения — planning, если этап неизвестен', () => {
    const orphan = state('paused', { previousStage: null })
    expect(resumeTask(orphan, AT).stage).toBe('planning')
  })

  it('resume не активен вне паузы', () => {
    const active = state('execution')
    expect(resumeTask(active, AT)).toBe(active)
  })

  it('отменяет из паузы и отказывается отменять терминальные', () => {
    const cancelled = cancelTask(state('paused', { previousStage: 'planning' }), AT)
    expect(cancelled.stage).toBe('cancelled')
    expect(cancelled.history.at(-1)).toMatchObject({ to: 'cancelled' })
    const done = state('done')
    expect(cancelTask(done, AT)).toBe(done)
  })

  it('анализатор может возобновить задачу из паузы напрямую', () => {
    const paused = pauseTask(state('validation'), AT)
    const { state: resumed } = applyAnalysis(
      paused,
      analysis({ stage: 'validation', step: 'Продолжаем' }),
      AT,
    )
    expect(resumed.stage).toBe('validation')
    expect(resumed.previousStage).toBeNull()
  })

  it('ограничивает историю переходов', () => {
    let current = state('planning')
    const stages: TaskStage[] = ['execution', 'planning', 'execution', 'planning']
    for (let i = 0; i < TASK_HISTORY_LIMIT + 5; i += 1) {
      const target = stages[i % stages.length]
      current = applyAnalysis(current, analysis({ stage: target }), AT).state
    }
    expect(current.history.length).toBe(TASK_HISTORY_LIMIT)
  })
})

describe('transitionTask — единая точка переходов', () => {
  it('применяет легальный переход и возвращает событие', () => {
    const outcome = transitionTask(state('planning'), 'execution', {
      at: AT,
      reason: 'Приступаем',
      steps: ['Забронировать'],
    })
    expect(outcome.status).toBe('applied')
    if (outcome.status !== 'applied') {
      return
    }
    expect(outcome.state.stage).toBe('execution')
    expect(outcome.state.steps).toEqual(['Забронировать'])
    expect(outcome.state.previousStage).toBeNull()
    expect(outcome.event).toMatchObject({
      kind: 'transition',
      from: 'planning',
      to: 'execution',
    })
  })

  it('возвращает unchanged на том же этапе', () => {
    const current = state('execution')
    const outcome = transitionTask(current, 'execution', {
      at: AT,
      reason: 'повтор',
    })
    expect(outcome.status).toBe('unchanged')
    if (outcome.status !== 'unchanged') {
      return
    }
    expect(outcome.state).toBe(current)
  })

  it('возвращает rejected и не трогает состояние при нелегальном переходе', () => {
    const current = state('planning')
    const outcome = transitionTask(current, 'done', {
      at: AT,
      reason: 'финал',
    })
    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') {
      return
    }
    expect(outcome.state).toBe(current)
    expect(outcome.rejection).toEqual({
      from: 'planning',
      to: 'done',
      reason: 'финал',
    })
  })

  it('pause/resume/cancel проходят через ту же точку', () => {
    const paused = pauseTask(state('execution'), AT)
    expect(paused.stage).toBe('paused')
    expect(paused.previousStage).toBe('execution')
    const resumed = resumeTask(paused, AT)
    expect(resumed.stage).toBe('execution')
    expect(resumed.previousStage).toBeNull()
    const cancelled = cancelTask(state('validation'), AT)
    expect(cancelled.stage).toBe('cancelled')
  })

  it('не отменяет терминальную задачу и не ставит на паузу дважды', () => {
    const done = state('done')
    expect(cancelTask(done, AT)).toBe(done)
    expect(pauseTask(done, AT)).toBe(done)
    const paused = state('paused', { previousStage: 'planning' })
    expect(pauseTask(paused, AT)).toBe(paused)
  })
})
