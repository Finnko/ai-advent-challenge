import type { TaskState } from '../domain/task/types'
import {
  ACTIVE_TASK_STAGES,
  TASK_ACTOR_LABELS,
  TASK_STAGE_LABELS,
  isTerminalTaskStage,
} from '../domain/task/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type TaskStatePanelProps = {
  state: TaskState | null
  enabled: boolean
  hasSession: boolean
  busy: boolean
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

export default function TaskStatePanel({
  state,
  enabled,
  hasSession,
  busy,
  onPause,
  onResume,
  onCancel,
}: TaskStatePanelProps) {
  if (!enabled) {
    return (
      <p className="demo-muted m-0 text-sm">
        Состояние задачи выключено для этой сессии. Включи тумблер во вкладке
        «Настройки» до первого сообщения.
      </p>
    )
  }
  if (!hasSession) {
    return (
      <p className="demo-muted m-0 text-sm">
        Отправь первое сообщение — появится сессия, и агент начнёт вести
        состояние задачи.
      </p>
    )
  }
  if (!state) {
    return (
      <p className="demo-muted m-0 text-sm">
        Состояние задачи появится после первого хода.
      </p>
    )
  }

  const terminal = isTerminalTaskStage(state.stage)
  const active = ACTIVE_TASK_STAGES.includes(state.stage)
  const paused = state.stage === 'paused'
  let stageVariant: 'accent' | 'warn' | 'default' = 'accent'
  if (paused) {
    stageVariant = 'warn'
  } else if (terminal) {
    stageVariant = 'default'
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="island-kicker m-0 text-[10px]">Состояние задачи</p>
          <p className="m-0 truncate text-sm font-bold text-[var(--ink)]">
            {state.title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={stageVariant}>
            {state.stage} · {TASK_STAGE_LABELS[state.stage]}
          </Badge>
          {paused && state.previousStage && (
            <Badge title="Этап, с которого задача была поставлена на паузу">
              вернуться в {state.previousStage}
            </Badge>
          )}
        </div>
      </div>

      <dl className="m-0 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="demo-muted text-[11px]">Текущий шаг</dt>
          <dd className="m-0 text-[var(--ink)]">
            {state.step.length > 0 ? state.step : '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="demo-muted text-[11px]">Ожидаемое действие</dt>
          <dd className="m-0 text-[var(--ink)]">
            {state.expectedAction.description.length > 0
              ? `${TASK_ACTOR_LABELS[state.expectedAction.actor]}: ${state.expectedAction.description}`
              : '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
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
        <span className="demo-muted text-xs">
          обновлено {formatTime(state.updatedAt)}
        </span>
      </div>

      <div>
        <p className="island-kicker m-0 mb-1 text-[10px]">
          История переходов
        </p>
        {state.history.length === 0 ? (
          <p className="demo-muted m-0 text-xs">Переходов ещё не было.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
            {[...state.history].reverse().map((transition, index) => (
              <li
                key={`${transition.at}-${index}`}
                className="flex flex-wrap items-center gap-1.5"
              >
                <Badge>
                  {transition.from} → {transition.to}
                </Badge>
                <span className="text-[var(--ink-muted)]">
                  {transition.reason}
                </span>
                <span className="demo-muted">{formatTime(transition.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
