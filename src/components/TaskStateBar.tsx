import type { TaskState } from '@lib/task-state/types'
import {
  ACTIVE_TASK_STAGES,
  TASK_ACTOR_LABELS,
  TASK_STAGE_LABELS,
  isTerminalTaskStage,
} from '@lib/task-state/types'
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
  onApprove: () => void
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
  onApprove,
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
  const needsApproval =
    !state.approved &&
    (state.stage === 'planning' || state.stage === 'execution')

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
          {needsApproval && (
            <Button size="sm" onClick={onApprove} disabled={busy}>
              Утвердить план
            </Button>
          )}
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
      {state.steps.length > 0 ? (
        <ol className="m-0 flex max-h-40 list-none flex-col gap-0.5 overflow-auto p-0 text-xs text-[var(--ink)]">
          {state.steps.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className={
                index === state.stepIndex
                  ? 'flex gap-1.5 rounded bg-[var(--surface-tint)] px-1.5 py-0.5 font-medium'
                  : 'flex gap-1.5 px-1.5 py-0.5 text-[var(--ink-muted)]'
              }
            >
              <span className="font-mono">{index + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-xs text-[var(--ink)]">
          {state.step.length > 0 ? state.step : '—'}
        </div>
      )}
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
