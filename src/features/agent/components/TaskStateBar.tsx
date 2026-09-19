import type { TaskState } from '../domain/task/types'
import {
  ACTIVE_TASK_STAGES,
  TASK_ACTOR_LABELS,
  TASK_STAGE_LABELS,
  isTerminalTaskStage,
} from '../domain/task/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type TaskStateBarProps = {
  state: TaskState | null
  enabled: boolean
  hasSession: boolean
  busy: boolean
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

function resolveStageVariant(
  paused: boolean,
  terminal: boolean,
): 'accent' | 'warn' | 'default' {
  if (paused) {
    return 'warn'
  }
  if (terminal) {
    return 'default'
  }
  return 'accent'
}

export default function TaskStateBar({
  state,
  enabled,
  hasSession,
  busy,
  onPause,
  onResume,
  onCancel,
}: TaskStateBarProps) {
  if (!enabled || !hasSession) {
    return null
  }
  if (!state) {
    return (
      <p className="demo-muted m-0 text-xs">
        Состояние задачи появится после первого хода.
      </p>
    )
  }

  const paused = state.stage === 'paused'
  const active = ACTIVE_TASK_STAGES.includes(state.stage)
  const terminal = isTerminalTaskStage(state.stage)
  const stageVariant = resolveStageVariant(paused, terminal)

  const planTitle = state.steps
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n')

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="island-kicker m-0 text-[10px]">Задача</span>
        <Badge variant={stageVariant} title={state.title}>
          {state.stage} · {TASK_STAGE_LABELS[state.stage]}
        </Badge>
        {paused && state.previousStage && (
          <Badge title="Этап, с которого задача поставлена на паузу">
            вернуться в {state.previousStage}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {active && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onPause}
              disabled={busy}
            >
              Пауза
            </Button>
          )}
          {paused && (
            <Button size="sm" onClick={onResume} disabled={busy}>
              Продолжить
            </Button>
          )}
          {!terminal && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={busy}
            >
              Отменить
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs text-[var(--ink)]" title={planTitle}>
        {state.steps.length > 1 && (
          <span className="mr-1 font-semibold">
            шаг {state.stepIndex + 1}/{state.steps.length} ·
          </span>
        )}
        {state.step.length > 0 ? state.step : '—'}
      </div>
      <div className="demo-muted text-xs">
        {'ожидается '}
        {TASK_ACTOR_LABELS[state.expectedAction.actor]}:{' '}
        {state.expectedAction.description.length > 0
          ? state.expectedAction.description
          : '—'}
      </div>
    </div>
  )
}
