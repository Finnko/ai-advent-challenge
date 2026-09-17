export type TaskStage =
  | 'planning'
  | 'execution'
  | 'validation'
  | 'done'
  | 'paused'
  | 'cancelled'

export type TaskActor = 'user' | 'agent'

export type TaskExpectedAction = {
  actor: TaskActor
  description: string
}

export type TaskTransition = {
  from: TaskStage
  to: TaskStage
  reason: string
  at: string
}

export type TaskState = {
  title: string
  stage: TaskStage
  previousStage: TaskStage | null
  step: string
  expectedAction: TaskExpectedAction
  updatedAt: string
  history: TaskTransition[]
}

export const TASK_STAGES: TaskStage[] = [
  'planning',
  'execution',
  'validation',
  'done',
  'paused',
  'cancelled',
]

export const ACTIVE_TASK_STAGES: TaskStage[] = [
  'planning',
  'execution',
  'validation',
]

export const TERMINAL_TASK_STAGES: TaskStage[] = ['done', 'cancelled']

export const TASK_STAGE_LABELS: Record<TaskStage, string> = {
  planning: 'Планирование',
  execution: 'Исполнение',
  validation: 'Проверка',
  done: 'Готово',
  paused: 'Пауза',
  cancelled: 'Отменено',
}

export const TASK_ACTOR_LABELS: Record<TaskActor, string> = {
  user: 'пользователь',
  agent: 'агент',
}

export const TASK_HISTORY_LIMIT = 20
export const TASK_TITLE_MAX = 80
export const TASK_STEP_MAX = 200
export const TASK_EXPECTED_MAX = 200

export function isTaskStage(value: unknown): value is TaskStage {
  return typeof value === 'string' && (TASK_STAGES as string[]).includes(value)
}

export function isTaskActor(value: unknown): value is TaskActor {
  return value === 'user' || value === 'agent'
}

export function isTerminalTaskStage(stage: TaskStage): boolean {
  return TERMINAL_TASK_STAGES.includes(stage)
}
