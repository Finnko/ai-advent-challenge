import type { SystemBlock } from '../agent'
import type { TaskState } from './types'
import { TASK_ACTOR_LABELS, TASK_STAGE_LABELS } from './types'

export const TASK_STATE_BLOCK_TITLE = 'СОСТОЯНИЕ ЗАДАЧИ:'

export const TASK_STATE_PRECEDENCE_LINE =
  'Блок СОСТОЯНИЕ ЗАДАЧИ выше — источник истины о текущем этапе, шаге и ожидаемом действии. Продолжай задачу с этого места и не переспрашивай то, что уже установлено.'

export function formatTaskStateBlock(state: TaskState): string {
  const lines = [
    TASK_STATE_BLOCK_TITLE,
    `- Задача: ${state.title}`,
    `- Этап: ${state.stage} (${TASK_STAGE_LABELS[state.stage]})`,
  ]
  if (state.stage === 'paused' && state.previousStage) {
    lines.push(
      `- На паузе; возобновить с этапа: ${state.previousStage} (${TASK_STAGE_LABELS[state.previousStage]})`,
    )
  }
  if (state.step.length > 0) {
    lines.push(`- Текущий шаг: ${state.step}`)
  }
  if (state.expectedAction.description.length > 0) {
    lines.push(
      `- Ожидаемое действие (${TASK_ACTOR_LABELS[state.expectedAction.actor]}): ${state.expectedAction.description}`,
    )
  }
  return lines.join('\n')
}

export function buildTaskStateBlocks(state: TaskState | null): SystemBlock[] {
  if (!state) {
    return []
  }
  return [{ kind: 'task-state' as const, content: formatTaskStateBlock(state) }]
}

export function buildTaskStateLine(state: TaskState | null): string | null {
  if (!state) {
    return null
  }
  const stage = `${state.stage} (${TASK_STAGE_LABELS[state.stage]})`
  let behavior: string
  if (state.stage === 'paused') {
    behavior =
      'Задача на паузе: не вызывай инструменты. Коротко подтверди паузу и жди пользователя.'
  } else if (state.stage === 'done') {
    behavior =
      'Задача завершена: не выполняй действий, пока пользователь не начнёт новую.'
  } else if (state.stage === 'cancelled') {
    behavior =
      'Задача отменена: не выполняй действий, пока пользователь не начнёт новую.'
  } else if (state.expectedAction.actor === 'user') {
    behavior = `Ожидается ход пользователя: ${state.expectedAction.description}. Не вызывай инструменты — задай уточняющий вопрос, если данных не хватает.`
  } else {
    behavior = `Ожидается действие агента: ${state.expectedAction.description}. Выполни его доступным инструментом или ответь, если действие уже выполнено.`
  }
  return [
    TASK_STATE_PRECEDENCE_LINE,
    `Текущий этап задачи: ${stage}.`,
    behavior,
  ].join('\n')
}
