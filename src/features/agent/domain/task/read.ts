import type { SystemBlock } from '../agent'
import type { TaskState } from './types'
import { TASK_ACTOR_LABELS, TASK_STAGE_LABELS, currentStep } from './types'

export const TASK_STATE_BLOCK_TITLE = 'СОСТОЯНИЕ ЗАДАЧИ:'

export const TASK_STATE_PRECEDENCE_LINE =
  'Блок СОСТОЯНИЕ ЗАДАЧИ выше — источник истины о текущем этапе, шаге и ожидаемом действии. Продолжай задачу с этого места и не переспрашивай то, что уже установлено.'

export function formatTaskStateBlock(state: TaskState): string {
  const step = currentStep(state)
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
  if (state.steps.length > 0) {
    lines.push(`- Шаг: ${state.stepIndex + 1}/${state.steps.length} — ${step}`)
    if (state.steps.length > 1) {
      lines.push(
        `- План этапа: ${state.steps
          .map((item, index) => `${index + 1}) ${item}`)
          .join('; ')}`,
      )
    }
  } else if (step.length > 0) {
    lines.push(`- Текущий шаг: ${step}`)
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
  const step = currentStep(state)
  let stepLine = ''
  if (state.steps.length > 1) {
    stepLine = `Текущий шаг ${state.stepIndex + 1} из ${state.steps.length}: ${step}.`
  } else if (step.length > 0) {
    stepLine = `Текущий шаг: ${step}.`
  }
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
  } else if (state.stage === 'planning') {
    behavior =
      'Этап планирования: не выполняй изменяющих действий. Предложи план и спроси подтверждение у пользователя; доступны только справочные инструменты (list*).'
  } else if (state.stage === 'validation') {
    behavior =
      'Этап проверки: изменяющие действия недоступны. Сверь результат с исходным запросом через справочные инструменты (list*) и подтверди его.'
  } else if (state.expectedAction.actor === 'user') {
    behavior = `Ожидается ход пользователя: ${state.expectedAction.description}. Не вызывай инструменты — задай уточняющий вопрос, если данных не хватает.`
  } else {
    behavior =
      'Работай строго в рамках текущего шага. Не выполняй другие шаги; когда шаг завершён — верни tool: null.'
  }
  return [
    TASK_STATE_PRECEDENCE_LINE,
    `Текущий этап задачи: ${stage}.`,
    ...(stepLine ? [stepLine] : []),
    behavior,
  ].join('\n')
}
